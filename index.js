require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.DISCORD_TOKEN;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

async function translateText(text) {
  const url = 'https://translation.googleapis.com/language/translate/v2';
  const params = { q: text || '無標題', target: 'zh-TW', key: GOOGLE_API_KEY };
  try {
    const response = await axios.post(url, null, { params });
    return response.data.data.translations[0].translatedText;
  } catch (error) {
    console.error('翻譯錯誤:', error.message, '狀態碼:', error.response?.status);
    return text;
  }
}

async function getHKNews() {
  if (!NEWS_API_KEY) {
    console.error('HK News 錯誤: NEWS_API_KEY 未定義');
    return new EmbedBuilder().setTitle('錯誤').setDescription('API Key 未配置，請檢查 Heroku 環境變數').setColor('#FF0000');
  }
  try {
    const url = `https://newsapi.org/v2/everything?q=(hong+kong+politics)+OR+(hong+kong+society)-finance-stock-market&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
    console.log('HK News URL:', url);
    const response = await global.fetch(url);
    console.log('HK News Response Headers:', JSON.stringify(response.headers));
    console.log('HK News Response Status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP 錯誤！狀態碼: ${response.status} - ${response.statusText} - ${await response.text()}`);
    }
    const data = await response.json();
    console.log('HK News Response Data:', JSON.stringify(data)); // 添加完整回應日誌
    if (data.status !== 'ok') {
      throw new Error(`API 回應錯誤: ${data.message || '無錯誤訊息'} - ${JSON.stringify(data)}`);
    }
    const now = new Date();
    const articles = data.articles
      .filter(article => {
        const pubDate = new Date(article.publishedAt);
        const isRecent = (now - pubDate) <= 24 * 60 * 60 * 1000;
        const isMajorSource = ['bbc', 'cnn', 'reuters', 'scmp'].includes(article.source.name.toLowerCase());
        const isKeyHeadline = ['breaking', 'urgent', 'top', 'major'].some(keyword => 
          article.title.toLowerCase().includes(keyword.toLowerCase())
        );
        return isRecent && (isMajorSource || isKeyHeadline);
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);
    const translatedArticles = await Promise.all(articles.map(async (article) => ({
      title: await translateText(article.title),
      description: article.description ? await translateText(article.description) : '',
      url: article.url,
      image: article.urlToImage || ''
    })));
    return new EmbedBuilder()
      .setTitle('香港政治與社會重點新聞播報')
      .setColor('#FF4500')
      .setDescription(translatedArticles.length ? translatedArticles.map((a, i) => `${i + 1}. **[${a.title}](${a.url})**\n${a.description}`).join('\n\n') : '無重點新聞')
      .setImage(translatedArticles.length ? translatedArticles[0].image : '');
  } catch (error) {
    console.error('HK News 錯誤:', error.message);
    return new EmbedBuilder().setTitle('錯誤').setDescription(`新聞獲取失敗: ${error.message}`).setColor('#FF0000');
  }
}

async function getWorldNews() {
  if (!NEWS_API_KEY) {
    console.error('World News 錯誤: NEWS_API_KEY 未定義');
    return new EmbedBuilder().setTitle('錯誤').setDescription('API Key 未配置，請檢查 Heroku 環境變數').setColor('#FF0000');
  }
  try {
    const url = `https://newsapi.org/v2/top-headlines?language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
    console.log('World News URL:', url);
    const response = await global.fetch(url);
    console.log('World News Response Status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP 錯誤！狀態碼: ${response.status} - ${response.statusText}`);
    }
    const data = await response.json();
    if (data.status !== 'ok') {
      throw new Error(`API 回應錯誤: ${data.message || '無錯誤訊息'}`);
    }
    const now = new Date();
    const articles = data.articles
      .filter(article => {
        const pubDate = new Date(article.publishedAt);
        const isRecent = (now - pubDate) <= 24 * 60 * 60 * 1000;
        const isMajorSource = ['bbc', 'cnn', 'reuters', 'ap'].includes(article.source.name.toLowerCase());
        const isKeyHeadline = ['breaking', 'urgent', 'top', 'major'].some(keyword => 
          article.title.toLowerCase().includes(keyword.toLowerCase())
        );
        return isRecent && (isMajorSource || isKeyHeadline);
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 5);
    const translatedArticles = await Promise.all(articles.map(async (article) => ({
      title: await translateText(article.title),
      description: article.description ? await translateText(article.description) : '',
      url: article.url,
      image: article.urlToImage || ''
    })));
    return new EmbedBuilder()
      .setTitle('國際重點新聞播報')
      .setColor('#1E90FF')
      .setDescription(translatedArticles.length ? translatedArticles.map((a, i) => `${i + 1}. **[${a.title}](${a.url})**\n${a.description}`).join('\n\n') : '無重點新聞')
      .setImage(translatedArticles.length ? translatedArticles[0].image : '');
  } catch (error) {
    console.error('World News 錯誤:', error.message);
    return new EmbedBuilder().setTitle('錯誤').setDescription(`新聞獲取失敗: ${error.message}`).setColor('#FF0000');
  }
}

client.once('ready', () => {
  console.log(`${client.user.tag} 已連線到 Discord!`);
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) console.error('指定頻道未找到:', CHANNEL_ID);
  setInterval(() => console.log(`心跳: ${new Date().toISOString()}`), 300000); // 每 5 分鐘日誌
  const now = new Date();
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
  const initialDelay = nextHour - now;
  setTimeout(() => {
    setInterval(async () => {
      console.log(`自動播報觸發時間: ${new Date().toISOString()}`);
      const channel = client.channels.cache.get(CHANNEL_ID);
      if (channel) {
        try {
          await channel.send({ embeds: [await getHKNews()] });
          await channel.send({ embeds: [await getWorldNews()] });
        } catch (error) {
          console.error('自動播報錯誤:', error.message);
        }
      }
    }, 3600000); // 每小時
  }, initialDelay);
});

client.on('messageCreate', async (message) => {
  console.log(`收到訊息: ${message.content} 在頻道 ${message.channel.id} 由 ${message.author.tag}`);
  if (message.content === '!hknews') {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
      try {
        await channel.send({ embeds: [await getHKNews()] });
        console.log(`成功發送 !hknews 到 ${CHANNEL_ID} 由 ${message.author.tag}`);
      } catch (error) {
        console.error('!hknews 錯誤:', error.message);
      }
    } else {
      console.error('頻道未找到:', CHANNEL_ID);
    }
  } else if (message.content === '!worldnews') {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
      try {
        await channel.send({ embeds: [await getWorldNews()] });
        console.log(`成功發送 !worldnews 到 ${CHANNEL_ID} 由 ${message.author.tag}`);
      } catch (error) {
        console.error('!worldnews 錯誤:', error.message);
      }
    } else {
      console.error('頻道未找到:', CHANNEL_ID);
    }
  }
});

client.login(TOKEN);