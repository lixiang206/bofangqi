// api/search.js
// Vercel Serverless 后端云函数：负责抗拦截抓取歌曲信息
export default async function handler(req, res) {
    // 允许前端跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { keywords } = req.query;
    if (!keywords) {
        return res.status(400).json({ error: 'Keywords required' });
    }

    // 后端备用骨干通道群（在云端服务器环境下请求，成功率极高）
    const targets = [
        `https://api.netease.tf/search?keywords=${encodeURIComponent(keywords)}`,
        `https://neteasecloudmusicapi-ten-orpin.vercel.app/search?keywords=${encodeURIComponent(keywords)}`
    ];

    for (let url of targets) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(4000) }); // 4秒超时控制
            if (response.ok) {
                const data = await response.json();
                return res.status(200).json(data);
            }
        } catch (e) {
            console.error(`云端中转节点失败，正在调度备份链路...`);
        }
    }

    return res.status(500).json({ error: '所有云端节点连接超时' });
}