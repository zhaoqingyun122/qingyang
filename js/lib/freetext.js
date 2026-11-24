// 青养 · 自由文本找药膳：用户用自己的话描述情况，匹配药膳 / 物质 / 状况
// 思路：口语同义词 → 中医功效主题 → 关联状况 → 对应药膳，并给出「为什么推荐」。
import { store } from './store.js';

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

/** 口语 → 中医主题的同义词表（尽量覆盖常见说法） */
export const SYNONYMS = {
  安神助眠: ['失眠', '睡不着', '睡不好', '易醒', '多梦', '心烦', '助眠', '安神', '睡眠差', '睡不实'],
  润肺止咳: ['咳嗽', '干咳', '痰', '咽干', '嗓子哑', '润肺', '止咳', '痰多', '喉咙痒'],
  健脾开胃: ['食欲差', '不想吃', '腹胀', '大便稀', '消化不好', '脾虚', '健脾', '积食', '饭后胀', '拉肚子', '腹泻'],
  祛湿消肿: ['湿气', '身体沉重', '舌苔厚', '大便黏', '水肿', '祛湿', '头发爱油', '犯困'],
  清热降火: ['上火', '口苦', '口腔溃疡', '长痘', '咽痛', '清热', '小便黄', '眼屎多', '火气大'],
  补气养血: ['贫血', '头晕', '心慌', '手脚凉', '气血', '乏力', '面色差', '容易累', '月经量少'],
  滋阴润燥: ['口干', '咽干', '皮肤干', '干燥', '滋阴', '生津', '润燥', '嘴唇干', '声音哑'],
  润肠通便: ['便秘', '大便干', '排便费力', '润肠', '几天一次', '便硬'],
  温阳散寒: ['怕冷', '手脚冰凉', '畏寒', '腰酸', '夜尿', '温阳', '阳虚', '小腹冷', '手脚发凉'],
  疏肝解郁: ['情绪', '郁闷', '烦躁', '叹气', '胸胁胀', '疏肝', '压力大', '爱生气', '经前乳胀'],
  养肝明目: ['眼干', '眼花', '眼睛', '明目', '视力', '眼涩', '看东西累'],
  降脂清肠: ['血脂', '胆固醇', '甘油三酯', '油腻', '降脂', '体检异常', '肚子大'],
  消食化积: ['吃撑', '积食', '消化不良', '油腻', '消食', '饭后胀', '胃胀'],
  调经养血: ['经期', '月经', '痛经', '经前', '小腹冷痛', '经期不适'],
  清热利咽: ['咽喉痛', '嗓子疼', '扁桃体', '利咽', '咽部不适', '嗓子干痛'],
};

/** 主题 → 关联状况 id（用于把「口语」映射到已有状况） */
const TOPIC_CONDITIONS = {
  安神助眠: ['shishen'],
  润肺止咳: ['kechuan'],
  健脾开胃: ['piwei'],
  祛湿消肿: ['shishi'],
  清热降火: ['shanghuo'],
  补气养血: ['qixue', 'jianshuai'],
  滋阴润燥: ['yinshui'],
  润肠通便: ['bianmi'],
  温阳散寒: ['qixue', 'jingqi'],
  疏肝解郁: ['ganyu'],
  养肝明目: [],
  降脂清肠: ['xueya'],
  消食化积: ['piwei'],
  调经养血: ['jingqi'],
  清热利咽: ['shanghuo', 'kechuan'],
};

/** 主题 → 相关物质 id（补充匹配） */
const TOPIC_HERBS = {
  安神助眠: ['bai-he', 'lian-zi', 'long-yan-rou'],
  润肺止咳: ['bai-he', 'bei-sha-shen', 'luo-han-guo', 'pang-da-hai'],
  健脾开胃: ['shan-yao', 'xiao-mi', 'bai-bian-dou', 'ji-nei-jin', 'shan-zha'],
  祛湿消肿: ['yi-yi-ren', 'chi-xiao-dou', 'fu-ling', 'he-ye'],
  清热降火: ['lv-dou', 'ju-hua', 'jin-yin-hua', 'jue-ming-zi'],
  补气养血: ['huang-qi', 'dang-shen', 'da-zao', 'long-yan-rou', 'gou-qi-zi'],
  滋阴润燥: ['mai-dong', 'yu-zhu', 'bei-sha-shen', 'bai-he'],
  润肠通便: ['hei-zhi-ma', 'yu-zhu', 'mai-dong'],
  温阳散寒: ['sheng-jiang', 'rou-gui', 'zi-su', 'da-zao'],
  疏肝解郁: ['mei-gui-hua', 'chen-pi', 'zi-su'],
  养肝明目: ['gou-qi-zi', 'ju-hua', 'jue-ming-zi'],
  降脂清肠: ['yan-mai', 'ku-qiao', 'he-ye', 'shan-zha'],
  消食化积: ['shan-zha', 'chen-pi', 'lai-fu-zi', 'ji-nei-jin'],
  调经养血: ['mei-gui-hua', 'da-zao', 'sheng-jiang', 'dang-shen'],
  清热利咽: ['luo-han-guo', 'pang-da-hai', 'jin-yin-hua', 'ju-hua'],
};

function matchedTopics(qRaw) {
  const n = norm(qRaw);
  if (!n) return [];
  const out = [];
  for (const [topic, words] of Object.entries(SYNONYMS)) {
    const hit = words.find((w) => n.includes(norm(w)));
    if (hit) out.push({ topic, word: hit });
  }
  return out;
}

/**
 * 自由文本搜索：返回 { query, topics, recipes, substances, conditions }
 * - recipes: [{ r, score, why }]
 * - substances: [{ s, score, why }]
 * - conditions: [{ c, score, why }]
 */
export function searchFreeText(qRaw) {
  const query = String(qRaw || '').trim();
  const n = norm(query);
  if (n.length < 2) return { query, topics: [], tooShort: true, recipes: [], substances: [], conditions: [] };

  const topics = matchedTopics(query);
  const topicNames = topics.map((t) => t.topic);
  const words = new Set([query, ...topics.map((t) => t.word)]);
  for (const t of topicNames) (SYNONYMS[t] || []).forEach((w) => words.add(w));

  const condIds = new Set();
  for (const t of topicNames) (TOPIC_CONDITIONS[t] || []).forEach((id) => condIds.add(id));

  const condScores = store.conditions
    .map((c) => {
      let score = 0;
      const why = [];
      if (norm(c.name).includes(n)) {
        score += 60;
        why.push(`状况名含「${query}」`);
      }
      for (const w of words) {
        if ((c.keywords || []).some((k) => norm(k).includes(norm(w)))) {
          score += 20;
          why.push(`关键词「${w}」`);
        }
        if (norm(c.summary).includes(norm(w))) {
          score += 8;
          why.push(`描述提到「${w}」`);
        }
      }
      if (condIds.has(c.id)) {
        score += 45;
        why.push(`与「${topicNames.filter((t) => (TOPIC_CONDITIONS[t] || []).includes(c.id)).join('、')}」相关`);
      }
      return { c, score, why: [...new Set(why)].slice(0, 3) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const matchConds = new Map(condScores.map((x) => [x.c.id, x.score]));

  const herbScore = (id) => TOPIC_HERBS[id] || [];

  const recipes = store.recipes
    .map((r) => {
      let score = 0;
      const why = [];
      for (const w of words) {
        const nw = norm(w);
        if (norm(r.name).includes(nw)) {
          score += 26;
          why.push(`药膳名「${w}」`);
        }
        if (norm(r.fit || '').includes(nw)) {
          score += 20;
          why.push(`适用「${w}」`);
        }
        if ((r.ingredients || []).some((i) => norm(i).includes(nw))) {
          score += 12;
          why.push(`含「${w}」`);
        }
        for (const sid of r.substanceIds || []) {
          const s = store.substance(sid);
          if (!s) continue;
          if (norm(s.name).includes(nw) || (s.alias || []).some((a) => norm(a).includes(nw))) {
            score += 16;
            why.push(`含药材「${s.name}」`);
          }
          if (norm(s.effects || '').includes(nw)) {
            score += 10;
            why.push(`${s.name}功效提到「${w}」`);
          }
        }
      }
      for (const cid of r.conditionIds || []) {
        const sc = matchConds.get(cid);
        if (sc) {
          score += Math.min(28, Math.round(sc / 3));
          why.push(`对应状况「${store.condition(cid)?.name || cid}」`);
        }
      }
      const ted = (r.substanceIds || []).filter((sid) => topicNames.some((t) => herbScore(sid).includes(t) || (r.substanceIds || []).some((x) => herbScore(x).includes(t))));
      if (ted.length) {
        score += 6;
        why.push(`用料契合「${topicNames.join('、')}」`);
      }
      return { r, score, why: [...new Set(why)].slice(0, 3) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const substances = store.substances
    .map((s) => {
      let score = 0;
      const why = [];
      for (const w of words) {
        const nw = norm(w);
        if (norm(s.name).includes(nw) || (s.alias || []).some((a) => norm(a).includes(nw))) {
          score += 30;
          why.push(`名称/别名「${w}」`);
        }
        if (norm(s.effects || '').includes(nw)) {
          score += 18;
          why.push(`功效「${w}」`);
        }
        if (norm(s.nature || '').includes(nw)) {
          score += 10;
          why.push(`性味「${w}」`);
        }
        if ((s.keywords || []).some((k) => norm(k).includes(nw))) {
          score += 8;
          why.push(`关键词「${w}」`);
        }
      }
      for (const t of topicNames) {
        if (herbScore(s.id).includes(t)) {
          score += 22;
          why.push(`常用于「${t}」`);
        }
      }
      return { s, score, why: [...new Set(why)].slice(0, 3) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    query,
    topics: topics.map((t) => t.topic),
    tooShort: false,
    recipes: recipes.slice(0, 12),
    substances: substances.slice(0, 8),
    conditions: condScores.slice(0, 6),
  };
}