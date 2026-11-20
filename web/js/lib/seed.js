// 青养 · 内置样例数据（访客、示例帖子、外观分类）
// 帖子的图片使用内置 SVG 手绘图，离线可用。

export const DEFAULT_VISITORS = [
  { id: 'me', name: '我', avatar: '我', isDefault: true, createdAt: 0 },
  { id: 'v_lin', name: '林小满', avatar: '满', isDefault: true, createdAt: 0 },
  { id: 'v_zhou', name: '周叔的厨房', avatar: '周', isDefault: true, createdAt: 0 },
  { id: 'v_duo', name: '多多妈', avatar: '多', isDefault: true, createdAt: 0 },
];

const svg = (inner) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6efe1"/><stop offset="1" stop-color="#eadfca"/></linearGradient></defs><rect width="400" height="240" fill="url(#g)"/>${inner}</svg>`
  );

export const POST_ILLUSTRATIONS = {
  porridge: svg(`
    <ellipse cx="200" cy="190" rx="120" ry="14" fill="#000" opacity=".07"/>
    <path d="M90 120h220a10 10 0 0 1 10 10c0 42-54 62-120 62s-120-20-120-62a10 10 0 0 1 10-10z" fill="#fff" stroke="#d9cdb6" stroke-width="3"/>
    <path d="M84 118h232a8 8 0 0 0 0-16H84a8 8 0 0 0 0 16z" fill="#efe6d4"/>
    <ellipse cx="200" cy="112" rx="88" ry="16" fill="#e3cf9d"/>
    <circle cx="170" cy="110" r="7" fill="#c9a86a"/><circle cx="205" cy="106" r="6" fill="#c9a86a"/><circle cx="232" cy="113" r="7" fill="#c9a86a"/><circle cx="190" cy="115" r="5" fill="#d7bb84"/>
    <path d="M160 74c10-14 22-14 30-2M206 70c9-12 20-12 28-1" stroke="#c8b48a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`),
  soup: svg(`
    <ellipse cx="200" cy="192" rx="118" ry="13" fill="#000" opacity=".07"/>
    <path d="M92 112h216v34c0 38-48 54-108 54s-108-16-108-54z" fill="#fff" stroke="#d9cdb6" stroke-width="3"/>
    <path d="M92 112h216" stroke="#e6dccb" stroke-width="6"/>
    <ellipse cx="200" cy="112" rx="108" ry="14" fill="#f3e3c4"/>
    <ellipse cx="200" cy="112" rx="86" ry="10" fill="#eed6ab"/>
    <circle cx="168" cy="111" r="9" fill="#e7b98a"/><circle cx="212" cy="108" r="8" fill="#e0ab7a"/><circle cx="240" cy="114" r="7" fill="#e7b98a"/>
    <path d="M170 68c8-10 18-10 24 0M212 62c8-10 18-10 24 0" stroke="#cbb896" stroke-width="3" fill="none" stroke-linecap="round" opacity=".75"/>`),
  tea: svg(`
    <ellipse cx="200" cy="196" rx="92" ry="12" fill="#000" opacity=".07"/>
    <path d="M132 96h136l-14 92c-2 10-12 16-54 16s-52-6-54-16z" fill="#fff" stroke="#d9cdb6" stroke-width="3"/>
    <path d="M132 96h136" stroke="#e6dccb" stroke-width="5"/>
    <ellipse cx="200" cy="96" rx="68" ry="11" fill="#e7d3a4"/>
    <circle cx="182" cy="94" r="6" fill="#d6c08a"/><circle cx="214" cy="98" r="7" fill="#d6c08a"/><circle cx="198" cy="88" r="5" fill="#e3d2a5"/>
    <path d="M200 170c-16-26-32-40-32-58 0-20 30-20 32 2 2-22 32-22 32-2 0 18-16 32-32 58z" fill="#8ab08a" opacity=".35"/>
    <path d="M186 64c6-8 14-8 20 0M204 58c6-8 14-8 20 0" stroke="#cbb896" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`),
  steam: svg(`
    <ellipse cx="200" cy="196" rx="108" ry="12" fill="#000" opacity=".07"/>
    <path d="M110 132h180a6 6 0 0 1 6 6c0 32-46 46-96 46s-96-14-96-46a6 6 0 0 1 6-6z" fill="#fff" stroke="#d9cdb6" stroke-width="3"/>
    <ellipse cx="200" cy="132" rx="90" ry="12" fill="#efdfc2"/>
    <circle cx="160" cy="130" r="10" fill="#e2b48a"/><circle cx="200" cy="126" r="11" fill="#dfae82"/><circle cx="238" cy="131" r="9" fill="#e2b48a"/>
    <circle cx="180" cy="136" r="6" fill="#cdbb92"/><circle cx="220" cy="137" r="6" fill="#cdbb92"/>`),
};

const daysAgo = (n, h = 9) => Date.now() - n * 86400000 - (24 - h) * 3600000;

export function seedPosts() {
  return [
    {
      id: 'post_seed_1',
      authorId: 'v_lin',
      createdAt: daysAgo(1, 20),
      text: '最近总觉得吃一点就饱、下午肚子胀，连着喝了五天山药薏米粥，早上那碗最有感觉。薏米我提前泡了一小时，山药用的是铁棍山药，切滚刀块，粥快好时再下锅，口感糯而不烂。青少年版只盛三分之二碗，晚饭后不加餐。',
      images: [POST_ILLUSTRATIONS.porridge],
      recipeId: 'shan-yao-yi-mi-zhou',
      substanceIds: [],
      tags: ['健脾', '早餐'],
      likes: ['v_zhou', 'v_duo'],
      favorites: ['me'],
      comments: [
        { id: 'c1', authorId: 'v_duo', text: '给上初中的女儿做，山药切小丁她也挺喜欢。', createdAt: daysAgo(1, 21) },
      ],
    },
    {
      id: 'post_seed_2',
      authorId: 'v_zhou',
      createdAt: daysAgo(3, 12),
      text: '家里老人说“夜里睡不踏实，吃点莲子百合”。我做了莲子百合银耳汤，百合最后十分钟才放，不然会煮散。大人一碗，孩子半碗，睡前两小时喝完，别喝太饱。',
      images: [POST_ILLUSTRATIONS.tea],
      recipeId: 'lian-zi-bai-he-yin-er-tang',
      substanceIds: [],
      tags: ['安神', '助眠'],
      likes: ['me', 'v_lin'],
      favorites: [],
      comments: [],
    },
    {
      id: 'post_seed_3',
      authorId: 'v_duo',
      createdAt: daysAgo(5, 18),
      text: '孩子春天爱咳嗽、有痰，煮了陈皮梨水。梨带皮切块，陈皮一小瓣就够，糖尽量少放。冰糖只放一小块提味，喝起来是清甜的。',
      images: [POST_ILLUSTRATIONS.steam],
      recipeId: 'chen-pi-pear-soup',
      substanceIds: [],
      tags: ['润肺', '家庭'],
      likes: ['v_zhou'],
      favorites: [],
      comments: [
        { id: 'c2', authorId: 'me', text: '我们家用的是雪梨，确实清甜。', createdAt: daysAgo(4, 10) },
      ],
    },
  ];
}

/** 社区发帖可选的“场景标签” */
export const POST_TAGS = ['早餐', '午餐', '晚餐', '下午茶', '家庭', '孩子', '老人', '换季', '健脾', '安神', '润肺', '祛湿', '轻断食', '记录'];

/** 首页分类的中文说明 */
export const CATEGORY_META = {
  补虚类: { tone: '#8fb98b', desc: '补气养血、益精填髓' },
  祛湿类: { tone: '#c9b47a', desc: '健脾利湿、化浊' },
  清热类: { tone: '#8bb6c9', desc: '清热生津、凉血' },
  消食导滞类: { tone: '#d9a66a', desc: '消食化积、行气' },
  理气类: { tone: '#b59ac9', desc: '理气宽中、解郁' },
  温里类: { tone: '#d98b7a', desc: '温中散寒、暖胃' },
  安神类: { tone: '#9a9ac9', desc: '养心安神、舒缓' },
  润肠类: { tone: '#a8c29a', desc: '润肠通便、利水' },
  活血类: { tone: '#c98b8b', desc: '活血化瘀、调经' },
  其他: { tone: '#a9a9a9', desc: '其他常用药食同源' },
};
