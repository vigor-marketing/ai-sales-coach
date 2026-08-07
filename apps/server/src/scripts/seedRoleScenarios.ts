import { prisma } from '../utils/prisma.js';

/**
 * Seed the role_scenarios table with fixed role-scenario matching.
 * Each role is matched with scenarios in the same region.
 * Maps the implicit background-based matching into explicit DB relations.
 */
async function seedRoleScenarios() {
  console.log('Seeding role-scenario mappings...');

  const roles = await prisma.aiRole.findMany();
  const scenarios = await prisma.scenario.findMany();

  // Build region sets
  const regionSets: Record<string, { roleIds: string[]; scenarioIds: string[] }> = {};

  for (const role of roles) {
    // Determine which region this role belongs to (same logic as training.ts)
    const region = matchRegion(role.region);
    if (!regionSets[region]) regionSets[region] = { roleIds: [], scenarioIds: [] };
    regionSets[region].roleIds.push(role.id);
  }

  for (const scenario of scenarios) {
    const region = scenario.region || '通用';
    if (!regionSets[region]) regionSets[region] = { roleIds: [], scenarioIds: [] };
    regionSets[region].scenarioIds.push(scenario.id);
  }

  let count = 0;

  // Match roles to scenarios: same region + universal scenarios
  for (const role of roles) {
    const roleRegion = matchRegion(role.region);
    const matchedScenarioIds = new Set<string>();

    // Add scenarios from same region
    if (regionSets[roleRegion]) {
      for (const sid of regionSets[roleRegion].scenarioIds) {
        matchedScenarioIds.add(sid);
      }
    }

    // Add universal scenarios
    if (regionSets['通用']) {
      for (const sid of regionSets['通用'].scenarioIds) {
        matchedScenarioIds.add(sid);
      }
    }

    for (const scenarioId of matchedScenarioIds) {
      const existing = await prisma.roleScenario.findUnique({
        where: { roleId_scenarioId: { roleId: role.id, scenarioId } },
      });
      if (!existing) {
        await prisma.roleScenario.create({ data: { roleId: role.id, scenarioId } });
        count++;
      }
    }
  }

  console.log(`Created ${count} role-scenario mappings`);
}

function matchRegion(region: string): string {
  if (/中东|沙特|阿联酋|伊拉克/.test(region)) return '中东';
  if (/欧洲|挪威|英国|法国|巴黎/.test(region)) return '欧洲';
  if (/俄罗斯/.test(region)) return '俄罗斯';
  if (/北美|美国|德州|墨西哥/.test(region)) return '北美';
  if (/中国|北京/.test(region)) return '中国';
  if (/印度/.test(region)) return '印度';
  if (/南美|巴西|阿根廷|哥伦比亚|拉美/.test(region)) return '南美';
  if (/澳洲/.test(region)) return '澳洲';
  if (/东南亚|马来西亚|印尼/.test(region)) return '东南亚';
  if (/日本/.test(region)) return '日本';
  if (/中亚|哈萨克/.test(region)) return '中亚';
  return '通用';
}

seedRoleScenarios()
  .then(() => { console.log('Done'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
