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
  const params = {
    q: text || '無標題',
    target: 'zh-TW',
    key: GOOGLE_API_KEY
  };
  try {
    const response = await axios.post(url, null, { params });
    return response.data.data.translations[0].translatedText;
  } catch (error) {
    console.error('翻譯錯誤:', error.message, '狀態碼:', error.response?.status);
    return text;
  }
}

async function getHKNews() {
  const url = `https://newsapi.org/v2/everything?q=hong+kong&language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
  console.log('HK News URL:', url);
  try {
    const response = await global.fetch(url);
    console.log('HK News Response Status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP 錯誤！狀態碼: ${response.status}`);
    }
    const data = await response.json();
    if (data.status !== 'ok') {
      throw new Error(`API 回應錯誤: ${data.message}`);
    }
    const articles = data.articles
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 3);
    const translatedArticles = await Promise.all(
      articles.map(async (article) => ({
        title: await translateText(article.title),
        description: article.description ? await translateText(article.description) : '',
        url: article.url,
        image: article.urlToImage || ''
      }))
    );
    const embed = new EmbedBuilder()
      .setTitle('香港重點新聞播報')
      .setColor('#FF4500')
      .setDescription(translatedArticles.length
        ? translatedArticles.map((a, i) => `${i + 1}. **[${a.title}](${a.url})**\n${a.description}`).join('\n\n')
        : '沒有新聞')
      .setImage(translatedArticles.length ? translatedArticles[0].image : '');
    return embed;
  } catch (error) {
    console.error('HK News 錯誤細節:', error.message);
    return new EmbedBuilder().setTitle('錯誤').setDescription('無法獲取香港新聞，請檢查 API Key 或網路。').setColor('#FF0000');
  }
}

async function getWorldNews() {
  const url = `https://newsapi.org/v2/top-headlines?language=en&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
  console.log('World News URL:', url);
  try {
    const response = await global.fetch(url);
    console.log('World News Response Status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP 錯誤！狀態碼: ${response.status}`);
    }
    const data = await response.json();
    if (data.status !== 'ok') {
      throw new Error(`API 回應錯誤: ${data.message}`);
    }
    const articles = data.articles
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 3);
    const translatedArticles = await Promise.all(
      articles.map(async (article) => ({
        title: await translateText(article.title),
        description: article.description ? await translateText(article.description) : '',
        url: article.url,
        image: article.urlToImage || ''
      }))
    );
    const embed = new EmbedBuilder()
      .setTitle('國際重點新聞播報')
      .setColor('#1E90FF')
      .setDescription(translatedArticles.length
        ? translatedArticles.map((a, i) => `${i + 1}. **[${a.title}](${a.url})**\n${a.description}`).join('\n\n')
        : '沒有新聞')
      .setImage(translatedArticles.length ? translatedArticles[0].image : '');
    return embed;
  } catch (error) {
    console.error('World News 錯誤細節:', error.message);
    return new EmbedBuilder().setTitle('錯誤').setDescription('無法獲取國際新聞，請檢查 API Key 或網路。').setColor('#FF0000');
  }
}

client.once('ready', () => {
  console.log(`${client.user.tag} 已連線到 Discord!`);
  setInterval(async () => {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
      await channel.send({ embeds: [await getHKNews()] });
      await channel.send({ embeds: [await getWorldNews()] });
    }
  }, 3600000); // 每小時
});

client.on('messageCreate', async (message) => {
  if (message.content === '!hknews') {
    await message.channel.send({ embeds: [await getHKNews()] });
  } else if (message.content === '!worldnews') {
    await message.channel.send({ embeds: [await getWorldNews()] });
  }
});

client.login(TOKEN);