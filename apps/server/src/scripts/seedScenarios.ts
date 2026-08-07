import { prisma } from '../utils/prisma.js';

const scenarios = [
  {
    title: '初次接触 - 建立信任关系',
    description: '首次与潜在客户建立联系，了解客户需求，介绍公司和产品，建立初步信任。',
    category: '商务拓展',
    difficulty: 'EASY',
    background: '你刚刚获得了一个中东油田服务公司的采购经理Tarek的联系方式。这是你第一次与他沟通，目的是建立初步联系并了解对方的需求。',
    objectives: '1. 成功建立联系 2. 了解客户基本信息和需求 3. 安排后续跟进',
    evaluationCriteria: '1. 开场白是否得体 2. 是否成功获取客户信息 3. 是否建立了初步信任',
  },
  {
    title: '技术方案评审 - 说服技术型客户',
    description: '面对技术型客户（如Mike Chen），需要展示产品的技术优势和现场应用案例，说服对方技术方案的可行性。',
    category: '技术销售',
    difficulty: 'MEDIUM',
    background: '北美独立油公司技术经理Mike Chen对你的MWD系统感兴趣，但提出了几个技术质疑。你需要详细解释技术方案，并提供现场案例。',
    objectives: '1. 成功回应技术质疑 2. 提供可信的技术案例 3. 推进到试用阶段',
    evaluationCriteria: '1. 技术回答是否专业准确 2. 案例是否具有说服力 3. 是否推进了销售进程',
  },
  {
    title: '官僚流程应对 - 俄罗斯国家油公司',
    description: '面对俄罗斯国家油公司的项目经理Olga，需要应对严格的官僚流程和合规要求，耐心推进审批。',
    category: '大客户关系',
    difficulty: 'HARD',
    background: 'Olga Petrova表示对你的产品感兴趣，但提出了大量的认证和合规文件要求。俄罗斯市场受到制裁影响，需要找到合规的解决方案。',
    objectives: '1. 满足合规文件要求 2. 找到制裁下的替代方案 3. 建立长期合作关系',
    evaluationCriteria: '1. 是否能提供完整的合规文件 2. 是否能找到制裁解决方案 3. 耐心和专业度',
  },
  {
    title: '价格谈判 - 应对低价竞争',
    description: '面对价格敏感型客户（如Tarek、Carlos），需要在价格压力下维持利润率，同时展示价值差异化。',
    category: '商务谈判',
    difficulty: 'HARD',
    background: 'Tarek和Carlos同时压价，你的竞争对手报出了更低的价格。你需要在不降价的情况下说服客户选择你。',
    objectives: '1. 维持目标价格不大幅降价 2. 成功展示价值差异化 3. 达成交易',
    evaluationCriteria: '1. 价格策略是否合理 2. 价值差异化阐述是否清晰 3. 谈判技巧',
  },
  {
    title: '安全危机应对 - 中东钻井现场',
    description: 'Hassan Al-Rashid的钻井现场发生了安全事件，需要紧急提供技术支持和服务，展示应急响应能力。',
    category: '危机处理',
    difficulty: 'EXPERT',
    background: 'Hassan的钻井现场发生BOP系统故障，造成停工。他对你公司的应急响应能力提出了严厉质疑。你需要在压力下提供解决方案。',
    objectives: '1. 快速提供技术解决方案 2. 展示应急响应能力 3. 修复客户信任',
    evaluationCriteria: '1. 响应速度 2. 解决方案的专业性 3. 危机沟通能力 4. 客户信任修复',
  },
  {
    title: '长期合作谈判 - 中国油服公司',
    description: '与中国油服公司项目经理Wang Wei谈判长期框架协议，需要展示综合服务能力和长期合作价值。',
    category: '战略合作',
    difficulty: 'MEDIUM',
    background: 'Wang Wei希望建立一个为期3年的框架协议，覆盖多个海外项目。他关心的是一站式服务和长期合作稳定性。',
    objectives: '1. 达成框架协议 2. 展示一站式服务能力 3. 建立长期合作信任',
    evaluationCriteria: '1. 方案完整性 2. 长期合作愿景阐述 3. 服务承诺可信度',
  },
  {
    title: '认证审核 - 欧洲EPC项目',
    description: '面对Jean-Pierre的严格认证要求，需要提供完整的ISO、API、CE等认证文件，应对审核。',
    category: '合规销售',
    difficulty: 'HARD',
    background: 'Jean-Pierre启动了供应商审核流程，对你的质量管理体系提出了详细要求。任何文档缺失都可能导致被淘汰。',
    objectives: '1. 提供完整的认证文件 2. 通过质量管理体系审核 3. 进入合格供应商名单',
    evaluationCriteria: '1. 文件完整性 2. 质量管理体系阐述 3. 对审核问题的回应能力',
  },
  {
    title: '成本效益分析 - 印度预算型客户',
    description: '面对Rajesh的成本分解要求，需要详细展示产品的成本效益分析，证明性价比优势。',
    category: '价值销售',
    difficulty: 'MEDIUM',
    background: 'Rajesh要求你提供详细的成本分解，包括TCO（总拥有成本）分析。他同时在比较3个竞争对手的报价。',
    objectives: '1. 提供可信的成本分解 2. 证明TCO优势 3. 在价格竞争中胜出',
    evaluationCriteria: '1. 成本分解的详细程度 2. TCO分析的逻辑性 3. 价格竞争力',
  },
  {
    title: '复杂谈判 - 多方利益协调',
    description: '同时应对多个客户，需要在不同客户之间协调资源和优先级，处理复杂的商业关系。',
    category: '综合谈判',
    difficulty: 'EXPERT',
    background: '你需要同时处理Hassan的紧急订单、Tarek的批量采购询价和Olga的长期合同谈判。资源有限，需要优先级决策。',
    objectives: '1. 合理分配资源 2. 满足各方需求 3. 最大化公司利益',
    evaluationCriteria: '1. 优先级决策合理性 2. 资源分配策略 3. 各方利益平衡能力',
  },
];

async function seedScenarios() {
  console.log('开始创建场景...');
  for (const scenario of scenarios) {
    const existing = await prisma.scenario.findFirst({ where: { title: scenario.title } });
    if (existing) {
      console.log(`  场景已存在: ${scenario.title}`);
      continue;
    }
    await prisma.scenario.create({ data: { ...scenario, isPreset: true } });
    console.log(`  创建场景: ${scenario.title}`);
  }
  console.log('场景创建完成！');
}

seedScenarios()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
