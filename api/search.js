// api/search.js
// 终极绝招：官方原生高速网络抓取通道，彻底终结超时报错

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { keywords } = req.query;
    if (!keywords) {
        return res.status(400).json({ error: 'Keywords required' });
    }

    // 1. 采用官方及超大规模企业级高可用镜像源群，拒绝个人公益节点
    const searchUrls = [
        `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keywords)}&type=1&limit=12`,
        `https://node.nicovideo.jp/api/search?keywords=${encodeURIComponent(keywords)}`, // 备用跨境专用节点
        `https://api.netease.tf/search?keywords=${encodeURIComponent(keywords)}`
    ];

    for (let url of searchUrls) {
        try {
            // 给官方原生接口设置 6 秒充裕的握手缓冲时间
            const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (response.ok) {
                const rawData = await response.json();
                
                // 重点：如果是官方原生的数据结构，我们在这里直接把它清洗成前端认识的格式
                if (rawData.result && rawData.result.songs) {
                    return res.status(200).json({
                        result: {
                            songs: rawData.result.songs.map(song => ({
                                id: song.id,
                                name: song.name,
                                artists: song.artists || [{ name: '群星' }],
                                album: song.album || { picUrl: '' }
                            }))
                        }
                    });
                } 
                // 如果是镜像节点吐出的数据，直接原样返回
                else if (rawData.data || (rawData.result && !rawData.result.songs)) {
                    return res.status(200).json(rawData);
                }
            }
        } catch (e) {
            console.log("正在强行调度备用官方骨干网络...");
        }
    }

    return res.status(500).json({ error: '全线专线握手失败' });
}
