// api/search.js
// 兼容性更强的高稳健版 Vercel Serverless 后端函数

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // 获取前端传过来的关键词
    const { keywords } = req.query;
    if (!keywords) {
        return res.status(400).json({ error: 'Keywords required' });
    }

    // 多组超高可用性的网易云镜像骨干节点
    const targets = [
        `https://api.netease.tf/search?keywords=${encodeURIComponent(keywords)}`,
        `https://neteasecloudmusicapi-ten-orpin.vercel.app/search?keywords=${encodeURIComponent(keywords)}`,
        `https://music.polyw.me/search?keywords=${encodeURIComponent(keywords)}`
    ];

    // 挨个尝试节点，谁快用谁
    for (let url of targets) {
        try {
            // 使用传统的 Promise.race 来控制5秒强制超时，防止 Vercel 函数死锁
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
            const fetchPromise = fetch(url);
            
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (response && response.ok) {
                const data = await response.json();
                return res.status(200).json(data);
            }
        } catch (e) {
            console.log(`当前节点抓取失败，正在切换下一条云专线...`);
        }
    }

    // 如果所有节点都挂了，返回500
    return res.status(500).json({ error: 'All backend nodes timed out' });
}
