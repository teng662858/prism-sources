const BASE_URL = 'https://www.dbku.tv';
const SOURCE_ID = 'dbku';

function absoluteUrl(path) {
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

function mediaIdFromPath(path) {
  const match = path.match(/\/voddetail\/(\d+)\.html/);
  if (!match) throw new Error(`unsupported media path: ${path}`);
  return `dbku:${match[1]}`;
}

function detailPath(mediaId) {
  const match = mediaId.match(/^dbku:(\d+)$/);
  if (!match) throw new Error(`unsupported media id: ${mediaId}`);
  return `/voddetail/${match[1]}.html`;
}

async function fetchDocument(path) {
  const response = await prism.request({ url: absoluteUrl(path) });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`request failed: ${response.status} ${path}`);
  }
  return response.body;
}

function stripLabel(value, label) {
  const index = value.indexOf(label);
  return index < 0 ? value.trim() : value.slice(index + label.length).trim();
}

function parseSearch(html) {
  const ids = prism.css(html, '#searchList .thumb a.myui-vodlist__thumb', 'href');
  const titles = prism.css(html, '#searchList .detail h4.title a');
  const actors = prism.css(html, '#searchList .detail p');
  const summaries = prism.css(html, '#searchList .detail .text-muted');

  return ids
    .map((href, index) => ({
      id: mediaIdFromPath(href),
      sourceId: SOURCE_ID,
      type: 'video',
      title: titles[index]?.trim() ?? '',
      author: stripLabel(
        actors.find((value) => value.includes('主演：')) ?? '',
        '主演：',
      ),
      summary:
        summaries.find((value) => value.includes('简介：'))?.trim() ?? '',
    }))
    .filter((item) => item.title);
}

function decodeBase64(value) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const input = value.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let buffer = 0;
  let output = '';
  for (const char of input) {
    if (char === '=') break;
    const index = chars.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(output);
}

globalThis.source = {
  meta: {
    id: SOURCE_ID,
    name: '独播库',
    version: '1.0.0',
    type: 'video',
    baseUrl: BASE_URL,
  },

  async search({ query, page }) {
    const encoded = encodeURIComponent(query.trim());
    const html = await fetchDocument(
      `/vodsearch/-------------.html?wd=${encoded}&page=${page}`,
    );
    return { items: parseSearch(html), hasMore: false };
  },

  async list() {
    return { items: [], hasMore: false };
  },

  async detail({ mediaId }) {
    const html = await fetchDocument(detailPath(mediaId));
    const title = prism.css(html, 'h1.title')[0]?.trim();
    if (!title) throw new Error('title not found');
    const rows = prism.css(html, '.myui-content__detail p.data');
    const authorRow = rows.find((value) => value.includes('主演：')) ?? '';
    const summary =
      prism.css(html, 'meta[name="description"]', 'content')[0] ??
      prism.css(html, '.sketch.content')[0] ??
      '';

    return {
      id: mediaId,
      sourceId: SOURCE_ID,
      type: 'video',
      title,
      author: stripLabel(authorRow, '主演：').replace(/\s+/g, ''),
      summary: stripLabel(summary, '简介：'),
    };
  },

  async chapters({ mediaId }) {
    const html = await fetchDocument(detailPath(mediaId));
    const hrefs = prism.css(
      html,
      '#playlist1 .myui-content__list a',
      'href',
    );
    const titles = prism.css(html, '#playlist1 .myui-content__list a');
    if (hrefs.length === 0) throw new Error('chapters not found');

    return hrefs.map((href, index) => ({
      id: absoluteUrl(href),
      mediaId,
      title: titles[index]?.trim() ?? `第${index + 1}集`,
      order: index,
    }));
  },

  async resolveVideo({ mediaId, chapterId }) {
    const html = await fetchDocument(chapterId);
    const encoded = html.match(/"url":"([^"]+)"/)?.[1];
    if (!encoded) throw new Error('player data not found');
    const url = decodeBase64(encoded);
    if (!url.startsWith('http')) throw new Error('invalid playback url');

    return {
      id: `${mediaId}:${chapterId}`,
      mediaId,
      chapterId,
      title: prism.css(html, '.myui-player__data h2.title')[0]?.trim() ?? '',
      order: 0,
      streamUrl: url,
      qualities: [{ label: '默认', url }],
    };
  },
};
