const SOURCE_ID = 'remote-demo';
const ITEM = {
  id: 'remote-demo:1',
  sourceId: SOURCE_ID,
  type: 'novel',
  title: '远程示例',
  author: 'Prism',
  summary: '外部导入验证源',
};

globalThis.source = {
  meta: {
    id: SOURCE_ID,
    name: '远程示例',
    version: '1.0.0',
    type: 'novel',
    baseUrl: 'https://example.com',
  },
  async search() {
    return { items: [ITEM], hasMore: false };
  },
  async detail() {
    return ITEM;
  },
  async chapters() {
    return [
      {
        id: 'remote-demo:1:chapter',
        mediaId: ITEM.id,
        title: '第一章',
        order: 0,
      },
    ];
  },
  async pages({ chapterId }) {
    return [
      {
        id: 'remote-demo:1:page',
        chapterId,
        order: 0,
        kind: 'text',
        text: '外部源导入成功。',
      },
    ];
  },
};
