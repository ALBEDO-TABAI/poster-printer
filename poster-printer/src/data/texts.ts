// Original bilingual copy written for Ready Poster Printer. Grouped into themed sets.
export interface TextSet {
  id: string; zh: string; en: string;
  headline: { en: string[]; zh: string[] };
  sub: { en: string[]; zh: string[] };
  small: { en: string[]; zh: string[] }; // small-group main (short phrases)
  note: { en: string[]; zh: string[] }; // 2-3 line captions (use \n)
  prose: { en: string[]; zh: string[] }; // short poems / paragraphs
  meta: { en: string[]; zh: string[] }; // tiny labels
  glyph: string[];
}

export const TEXT_SETS: TextSet[] = [
  {
    id: 'grid', zh: '版式札记', en: 'Layout Notes',
    headline: {
      en: ['Order Loves Accident', 'Columns Breathe', 'The Quiet Module', 'Measure Twice', 'Room To Read', 'White Space Wins', 'Lines Under Weather', 'Every Cell Counts', 'Form Finds Rhythm', 'Built On Rhythm', 'Gridlock Released', 'A Page Unfolds', 'Rule & Rupture', 'Hold The Margin', 'Slow Typography', 'Structure Speaks'],
      zh: ['格中有风', '秩序生花', '留白即语言', '线与面', '方寸之间', '栏外有天', '字有呼吸', '版心', '偶然的秩序', '纵横', '一格一世界', '骨与肉'],
    },
    sub: {
      en: ['A system for unexpected pages', 'Swiss rules, loose hands', 'Where the column ends, the eye begins', 'Twelve units, endless outcomes', 'Measured space for restless ideas', 'Type sits, images lean', 'Each draw keeps the rules and breaks the habit'],
      zh: ['在规则里留一扇窗', '网格负责秩序，偶然负责惊喜', '每一次抽取都是新的开始', '让文字找到自己的位置', '版面是安静的建筑', '规矩之内，随心所欲'],
    },
    small: {
      en: ['Margin First', 'Read Slowly', 'Space Holds', 'Keep Aligned', 'Cut Clean', 'Let It Rest', 'Mind The Gap', 'Scale Shift', 'Edge Tension', 'Soft Weight', 'Open Field', 'Fixed Point', 'Half Tone', 'One Column', 'Wide Format', 'Second Draft'],
      zh: ['先定边距', '慢读', '留白', '对齐', '干净利落', '轻重', '节奏', '比例', '边缘', '开合', '起承转合', '定点'],
    },
    note: {
      en: ['The grid is a promise\nnot a prison', 'Set the margin\nthen let the page decide', 'Alignment is a kind\nof quiet agreement', 'Small type carries\nthe large idea', 'Repeat a measure\nuntil it sings', 'One rule kept\nis worth ten bent'],
      zh: ['网格是约定\n不是牢笼', '先立边界\n再谈自由', '对齐是一种\n安静的默契', '小字承载\n大意', '重复一个尺度\n直到它有了节奏'],
    },
    prose: {
      en: ['We drew the lines first\nand waited for the words\nto find their seats', 'A column of air\nbetween two blocks of meaning\nis also content', 'Nothing here is random\nexcept the order\nin which it arrives'],
      zh: ['先画线\n再等字\n一一落座', '两段意义之间\n那一栏空气\n也是内容', '没有什么是随机的\n除了它们\n到来的顺序'],
    },
    meta: { en: ['Vol. 07', 'No. 12', 'Issue 03', 'Proof', 'Draft', 'Plate IV', 'Folio', 'Sheet 2/6', 'Grid 12', 'Edition', 'Study', 'Index', 'Module', 'Ref. 041', 'A/B Test', 'Specimen'], zh: ['第七期', '校样', '初稿', '图版四', '研究', '索引', '模数', '样张'] },
    glyph: ['A', 'R', 'G', 'M', 'K', 'Q', '7', '12', '&', 'é', '格', '栏'],
  },
  {
    id: 'city', zh: '城市漫游', en: 'City Drift',
    headline: {
      en: ['After Midnight', 'Neon & Rain', 'Night Shift', 'Late Trains', 'Concrete Bloom', 'Streetlight Hours', 'City Of Echoes', 'Blue Hour', 'Crosswalk Diaries', 'Rooftop Season'],
      zh: ['夜行', '雨夜霓虹', '末班车', '城市漫游', '街角', '天台季节', '蓝调时刻', '十字路口'],
    },
    sub: {
      en: ['Notes from a sleepless district', 'Walking until the map runs out', 'A field guide to small lights', 'Strangers, signals, steam'],
      zh: ['写给失眠街区的笔记', '一直走到地图尽头', '城市微光观察手册', '陌生人与信号灯'],
    },
    small: { en: ['Exit B', 'Platform 4', 'Open Late', 'Last Call', 'Wet Asphalt', 'Night Bus', 'Corner Shop', 'Sound Check'], zh: ['B 出口', '四号站台', '营业至深夜', '最后一班', '湿柏油路', '夜班巴士'] },
    note: { en: ['Every window\nis a small film', 'The city hums\nin a minor key', 'Follow the signs\nthen ignore them'], zh: ['每一扇窗\n都是一部短片', '城市用小调\n低声哼唱', '跟着路牌走\n然后忘掉它'] },
    prose: { en: ['The rain arrived\nbefore the forecast\nand stayed for the encore'], zh: ['雨比预报\n来得更早\n也走得更晚'] },
    meta: { en: ['23:47', 'Line 2', 'Zone C', 'Ward 9', 'N 35.68°', 'E 139.76°', 'Map 04'], zh: ['二号线', 'C 区', '北纬三十五度'] },
    glyph: ['N', 'B', '24', '夜', 'X'],
  },
  {
    id: 'nature', zh: '山野四季', en: 'Seasons',
    headline: {
      en: ['Mountain Light', 'Slow Spring', 'Field Notes', 'Tidal Hours', 'Green Silence', 'The Long Meadow', 'Autumn Ledger', 'Snow Theory', 'Moss & Stone', 'Summer Ends Softly'],
      zh: ['山色', '春迟', '野帖', '潮汐时刻', '青色寂静', '秋日账簿', '雪的理论', '苔与石', '夏尽'],
    },
    sub: {
      en: ['A season measured in shadows', 'Collected on foot, sorted by light', 'Weather reports from the high ground', 'What the river keeps'],
      zh: ['用影子丈量季节', '徒步采集，按光线归档', '来自高处的天气报告', '河流记住的事'],
    },
    small: { en: ['First Frost', 'Low Tide', 'High Pass', 'Wild Iris', 'Pine Shade', 'Dry Creek', 'North Slope', 'Rain Season'], zh: ['初霜', '退潮', '山口', '野鸢尾', '松荫', '北坡', '雨季', '惊蛰'] },
    note: { en: ['Leaves keep\nthe calendar honest', 'Altitude is\na kind of patience', 'Listen for the\nwater under snow'], zh: ['落叶让日历\n保持诚实', '海拔是一种\n耐心', '听雪下\n流水的声音'] },
    prose: { en: ['We climbed for the view\nand found the fog instead\nit was enough'], zh: ['为风景而上山\n却遇见了雾\n也很好'] },
    meta: { en: ['Alt. 2140 m', '06:12', 'Day 14', 'Trail 3', 'Sheet 22', 'Spring'], zh: ['海拔二一四〇米', '第十四天', '三号步道', '立春'] },
    glyph: ['S', 'F', 'W', '山', '水', '春', '04'],
  },
  {
    id: 'music', zh: '声音实验', en: 'Sound Lab',
    headline: { en: ['Loud Silence', 'Analog Heart', 'Side B', 'Tape Hiss', 'Low Frequency', 'Feedback Loop', 'Room Tone'], zh: ['声场', 'B 面', '低频', '回授', '磁带', '房间音'] },
    sub: { en: ['Live recordings from small rooms', 'Three nights of improvised noise', 'Music for empty stations'], zh: ['小房间现场录音', '三晚即兴噪音', '写给空站台的音乐'] },
    small: { en: ['Track 01', 'Encore', 'Mono Mix', 'Reverb', 'Live Set', 'Doors 19:00'], zh: ['第一轨', '返场', '单声道', '混响', '现场'] },
    note: { en: ['Turn it down\nuntil you hear more', 'Every hum\nhas a home'], zh: ['把音量调低\n才能听见更多', '每一段嗡鸣\n都有归处'] },
    prose: { en: ['The amplifier warmed\nlike a small sun\nand the room leaned in'], zh: ['功放慢慢变暖\n像一颗小太阳\n整个房间都靠了过来'] },
    meta: { en: ['33 RPM', '120 BPM', 'A440', 'Stereo', 'Vol. 11', 'Hall 2'], zh: ['每分钟三十三转', '立体声', '二号厅'] },
    glyph: ['B', 'Hz', '33', '音', '♯'],
  },
  {
    id: 'space', zh: '宇宙信号', en: 'Deep Field',
    headline: { en: ['Deep Field', 'Orbit Notes', 'Far Signal', 'Event Horizon', 'Dust & Light', 'Night Survey', 'Zero Gravity'], zh: ['深空', '轨道笔记', '远方信号', '星尘', '夜巡', '失重'] },
    sub: { en: ['Observations from the edge of the map', 'A catalogue of distant weather', 'Light that left before we arrived'], zh: ['来自地图边缘的观测', '遥远天气目录', '在我们抵达前就出发的光'] },
    small: { en: ['Red Shift', 'Apogee', 'Dark Matter', 'Star Chart', 'Long Exposure', 'Comet Tail'], zh: ['红移', '远地点', '暗物质', '星图', '长曝光'] },
    note: { en: ['Distance is\njust delay', 'We read the sky\nlike old mail'], zh: ['距离不过是\n延迟', '我们读星空\n像读旧信'] },
    prose: { en: ['Somewhere a star\nis finishing its sentence\nwe will hear it later'], zh: ['某颗星\n正说完最后一句话\n我们晚些才能听见'] },
    meta: { en: ['RA 05h 35m', 'Dec −05° 23′', 'Mag 4.0', 'Obs. 118', 'λ 656 nm'], zh: ['赤经五时', '星等四', '观测一一八'] },
    glyph: ['O', 'Ø', '∞', '星', '00'],
  },
  {
    id: 'tea', zh: '茶与日常', en: 'Daily Ritual',
    headline: { en: ['Slow Morning', 'Tea Hours', 'Steam Rising', 'Second Cup', 'Kitchen Light', 'Small Rituals'], zh: ['慢早晨', '一盏茶', '热气升起', '第二杯', '厨房的光', '小仪式'] },
    sub: { en: ['Recipes for unhurried days', 'Leaves, water, patience', 'A guide to doing one thing well'], zh: ['写给不慌不忙的日子', '茶叶、清水与耐心', '把一件小事做好'] },
    small: { en: ['Steep 3 Min', 'Green Leaf', 'Warm Cup', 'Open Window', 'Bread & Jam'], zh: ['焖三分钟', '绿叶', '温杯', '开窗', '面包与果酱', '清明前'] },
    note: { en: ['Wait for the water\nto stop talking', 'A good day starts\nwith a small pause'], zh: ['等水\n安静下来', '好的一天\n从停顿开始'] },
    prose: { en: ['The kettle sang once\nthe light moved one tile\nand nothing else happened'], zh: ['水壶唱了一声\n光挪了一块地砖\n别的什么也没发生'] },
    meta: { en: ['85 °C', '7:30 am', 'Batch 05', 'No. 2 Leaf', 'Kyoto'], zh: ['八十五度', '早七点半', '二号茶'] },
    glyph: ['T', '茶', '&', '2', 'C'],
  },
  {
    id: 'exhibit', zh: '展览海报', en: 'Exhibition',
    headline: { en: ['New Forms', 'Material Study', 'Open Studio', 'Shape Of Things', 'Paper Architecture', 'Image & Object', 'Graduate Show'], zh: ['新形式', '材料研究', '开放工作室', '物之形', '纸上建筑', '图像与物件', '毕业展'] },
    sub: { en: ['Works on paper, 1960 to now', 'A group show in twelve rooms', 'Prints, posters and proofs'], zh: ['纸上作品，一九六〇至今', '十二个展厅的群展', '版画、海报与校样'] },
    small: { en: ['Opening Night', 'Free Entry', 'Gallery 3', 'Guided Tour', 'Artist Talk', 'Print Room'], zh: ['开幕夜', '免费入场', '三号展厅', '导览', '艺术家对谈', '版画室'] },
    note: { en: ['Thursday to Sunday\n11:00 — 19:00', 'Bring a friend\nleave with a question'], zh: ['周四至周日\n十一点至十九点', '带一位朋友\n带走一个问题'] },
    prose: { en: ['Objects wait patiently\nfor someone to\nlook twice'], zh: ['物件安静地等待\n有人愿意\n多看一眼'] },
    meta: { en: ['03.14 — 06.30', 'Hall A', 'Cat. 112', 'Free', 'RSVP', '2026'], zh: ['三月十四日起', 'A 馆', '图录一一二'] },
    glyph: ['E', 'X', '3', '展', '%'],
  },
];

export interface CustomText { headline: string; sub: string; small: string[]; note: string[]; prose: string; meta: string[] }
