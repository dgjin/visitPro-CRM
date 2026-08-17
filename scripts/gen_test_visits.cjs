// 生成 100 条拜访记录测试数据 -> seed_visits_test.sql
// 用法: node scripts/gen_test_visits.js
const fs = require('fs');
const path = require('path');

const DIR = '/tmp/visitgen';
const OUT = path.join(DIR, 'seed_visits_test.sql');

// ---------- 读取客户/用户 ----------
const parseTsv = (file) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const header = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const cells = l.split('\t');
    const obj = {};
    header.forEach((h, i) => (obj[h] = cells[i] === 'NULL' ? null : cells[i]));
    return obj;
  });
};
const clients = parseTsv(path.join(DIR, 'clients.tsv'));
const users = parseTsv(path.join(DIR, 'users.tsv')).filter((u) => u.id !== 'user_admin');

// ---------- 素材库 ----------
const surnames = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐韩冯于董萧'.split('');
const givens = ['伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '志强', '建华', '建国', '晓东', '晓红'];
const roles = ['董事长', '总经理', '副总经理', '财务总监', '融资部部长', '资金部经理', '办公室主任', '董事会秘书', '投资部经理', '财务部部长'];
const types = ['线下拜访', '线下拜访', '线下拜访', '线上会议', '电话沟通', '客户到访']; // 线下为主
const sentiments = ['积极', '积极', '积极', '中性', '中性', '中性', '消极'];

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const person = () => pick(surnames) + pick(givens);

// 内容主题（围绕不良资产/金融业务场景）
const topics = [
  { t: '不良资产收购', d: '就客户持有的不良资产包转让事宜进行深入交流，客户介绍了资产包的构成、规模及处置现状，双方初步探讨了收购合作的可能模式。' },
  { t: '债务重组合作', d: '客户因下属子公司债务压力较大，希望借助我司专业优势开展债务重组，详细讨论了重组方案框架与推进节奏。' },
  { t: '市场化债转股', d: '围绕客户集团内重点企业的债转股项目进行沟通，客户对债转股落地条件与退出安排较为关注。' },
  { t: '综合金融服务方案', d: '向客户介绍我司综合金融服务方案，涵盖资产收购、重组、投资等业务线，客户表示多个板块有合作空间。' },
  { t: '存量项目推进', d: '跟进存量合作项目进展，就项目投放条件、风控要求与客户交换意见，明确了下一步材料补充清单。' },
  { t: '实质性尽调对接', d: '与对接部门确认尽调资料清单与现场尽调安排，客户承诺本周内提供财务报表与抵押物权属文件。' },
  { t: '资产盘活咨询', d: '客户就旗下低效资产的盘活路径咨询专业意见，我方建议结合重组与引入产业投资人方式推进。' },
  { t: '授信与额度沟通', d: '沟通年度合作额度与授信安排，客户对我司响应速度与专业度表示认可，希望扩大合作规模。' },
];
const followTemplates = [
  '整理本次拜访纪要并发送客户确认；{d}周内完成初步合作方案初稿，提交内部评审。',
  '跟进客户提供的尽调资料，{d}个工作日内反馈补充清单；安排下次现场尽调时间。',
  '将客户需求同步至业务与风控部门，{d}周内形成综合金融服务方案并与客户二次沟通。',
  '跟进协议条款协商进展，推动双方法务在{d}周内完成合同文本确认。',
  '与客户约定{d}周后复盘项目进展，同步内部立项所需材料。',
];
const actionPool = [
  '整理会议纪要并抄送客户对接人',
  '收集客户近三年审计报告',
  '起草合作框架协议初稿',
  '协调风控部门开展预审',
  '预约下次拜访并确认参会人员名单',
  '跟踪资产包尽调资料到位情况',
  '向客户发送综合金融服务方案',
  '推动内部立项审批流程',
];

// ---------- SQL 转义 ----------
const esc = (s) => (s == null ? 'NULL' : `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`);

// ---------- 生成 ----------
const rows = [];
const today = new Date();
for (let i = 0; i < 100; i++) {
  const c = clients[rnd(clients.length)];
  const type = pick(types);
  const topic = pick(topics);
  const sentiment = pick(sentiments);

  // 日期：近 120 天内随机，ISO 格式
  const d = new Date(today.getTime() - rnd(120) * 86400000 - rnd(10) * 3600000);
  const dateIso = d.toISOString();

  // 负责人：优先客户负责人（取第一个名字），否则随机员工
  let ownerId = null, ownerName = null;
  const ownerFirst = c.ownerName ? c.ownerName.split('；')[0].trim() : null;
  const matched = ownerFirst ? users.find((u) => u.name === ownerFirst) : null;
  if (matched) { ownerId = matched.id; ownerName = matched.name; }
  else { const u = pick(users); ownerId = u.id; ownerName = u.name; }

  const contact = person();
  const contactRole = pick(roles);
  const clientParts = `${contact},${person()}`;
  const ourParts = `${ownerName},${person()}`;

  const detail = sentiment === '消极'
    ? '客户对当前合作条件有所保留，提出定价与流程方面的顾虑，需进一步沟通协调。'
    : sentiment === '中性'
      ? '双方就关键事项交换了意见，尚需进一步论证。'
      : '客户合作意愿较强，对后续推进节奏表示期待。';

  const content = `本次${type}围绕${topic.t}展开。${topic.d}${detail}`;
  const summary = `与${c.name}就${topic.t}进行沟通，${sentiment === '积极' ? '客户合作意愿明确，达成初步共识' : sentiment === '中性' ? '双方交换意见，待进一步跟进' : '客户存在顾虑，需持续沟通化解'}。`;
  const actions = JSON.stringify(Array.from(new Set([pick(actionPool), pick(actionPool), pick(actionPool)])));
  const followUp = pick(followTemplates).replace('{d}', String(1 + rnd(3)));

  // 地点：线下/到访用客户区域，线上/电话留空
  const location = (type === '线下拜访' || type === '客户到访') ? `${c.region || '客户办公地'}客户办公场所` : null;

  rows.push([
    esc(`test-visit-${String(i + 1).padStart(3, '0')}`),
    esc(c.id),
    esc(c.name),
    esc(dateIso),
    esc(content),
    esc(type),
    esc(ownerId),
    esc(ownerName),
    esc(location),
    esc(contact),
    esc(contactRole),
    esc(clientParts),
    esc(ourParts),
    'NULL', // recordingData（已废弃）
    'NULL', // recordings
    'NULL', // customFields
    esc(summary),
    esc(sentiment),
    esc(actions),
    esc(followUp),
  ]);
}

const cols = 'id, clientId, clientName, date, content, type, ownerId, ownerName, location, clientContact, clientContactRole, clientParticipants, ourParticipants, recordingData, recordings, customFields, summary, sentiment, actionItems, followUpDraft';
let sql = `-- 拜访记录测试数据（100 条），id 前缀 test-visit-，可用 DELETE FROM visits WHERE id LIKE 'test-visit-%' 清理\n`;
sql += `INSERT INTO visits (${cols}) VALUES\n`;
sql += rows.map((r) => `(${r.join(', ')})`).join(',\n') + ';\n';
fs.writeFileSync(OUT, sql);
console.log(`已生成 ${rows.length} 条 -> ${OUT}`);
