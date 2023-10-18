require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Configuration, OpenAIApi } = require('openai');
const instructions = require('./instructions');
const { v4: uuidv4 } = require('uuid');

const MODEL_NAME = 'gpt-3.5-turbo';
const configuration = new Configuration({ apiKey: process.env.CHATGPT_API_KEY });
const openai = new OpenAIApi(configuration);
const history = [];
const SESSION_FILE_PATH = process.env.SESSION_FILE_PATH;
const client = SESSION_FILE_PATH ? new Client({ session: require(SESSION_FILE_PATH) }) : new Client();

client.on('qr', async (qr) => {
    console.clear();
    console.log(`CONECTE AO WHATSAPP 
                \nEscaneie o QR-Code abaixo utilizando o aplicativo WhatsApp. 
                \nAbra o app. Vá em ⋮ (Mais opções) > Aparelhos conectados > Conectar um aparelho. 
                \nEm seguida escaneie o código QR\n`);
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.clear();
    console.log(`SEJA BEM-VINDO AO CHATROOT - ROOTHUB®️\n\n`);

    client.on('message', async (message) => {
        if (message.body && message.body.trim().length > 0) {
            const messageId = uuidv4();
            if (message.body.trim().toLowerCase() === 'limpar') { // Se a mensagem for "limpar"
                history.length = 0; // Limpa o histórico
                message.reply('A conversa foi limpa. \nOlá. Em que posso ajudar?'); // Responde ao usuário
                return; // Retorna para evitar o processamento adicional desta mensagem
            } else {
                if (!history.some(([_, id]) => id === messageId)) {
                    history.push([message.body, messageId]);
                    const startTime = new Date();
                    const [hours, minutes] = [startTime.getHours(), startTime.getMinutes()].map((n) => n.toString().padStart(2, '0'));

                    try {
                        const sender = message.from.includes('-') ? 'group' : 'user';
                        if (sender === 'user' || (sender === 'group' && message.author === client.user.jid)) {
                            console.log(`${message.from.replace(/@c.us/g, '')}: ${message.body}\n${hours}:${minutes}\n`);
                            const messages = [...instructions, { role: 'user', content: message.body }];
                            const completion = await openai.createChatCompletion({ model: MODEL_NAME, messages, temperature: 0.9, max_tokens: 2048, n: 1, stop: null });
                            const completion_text = completion.data.choices[0].message.content.trim();
                            console.log(`ChatRoot: ${completion_text}\n${hours}:${minutes}\n\n`);
                            client.sendMessage(message.from, completion_text);
                            history.push([message.body, completion_text]);
                        }
                    } catch (error) {
                        console.log(`Erro ao processar mensagem: ${error.message}`);
                    }
                }
            }
        }
    });

    if (SESSION_FILE_PATH) {
        client.on('authenticated', async (sessionData) => {
            require('fs').writeFile(SESSION_FILE_PATH, JSON.stringify(sessionData));
        });
    }
});

client.on('disconnected', async (reason) => {
    console.log(`Cliente desconectado: ${reason}`);
    if (SESSION_FILE_PATH) {
        console.log('Tentando reconectar');
        try {
            await client.initialize();
        } catch (error) {
            console.error(`Erro ao reconectar: ${error.message}`);
        }
    }
});

async function startClient() {
    try {
        await client.initialize();
    } catch (error) {
        console.error(`Erro ao inicializar o cliente: ${error.message}`);
    }
}

startClient();