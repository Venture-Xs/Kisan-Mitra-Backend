import dotenv from 'dotenv'
import express from 'express'
import { ChatOpenAI } from "langchain/chat_models/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { formatDocumentsAsString } from "langchain/util/document";

dotenv.config();
const app = express()

app.use(express.json());

let previousChat;

app.get('/', async (req, res) => {
    const currentQuestion = req.body.question;
    console.log(currentQuestion);
    /* Initialize the LLM to use to answer the question */
    const model = new ChatOpenAI({ verbose: true, openAIApiKey: process.env.OPENAI_API_KEY, maxTokens: 100, topP: 1, });
    /* Load in the file we want to do question answering over */
    const text = fs.readFileSync("bank.txt", "utf8");
    /* Split the text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([text]);
    /* Create the vectorstore */
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings());
    const retriever = vectorStore.asRetriever();

    const formatChatHistory = (
        human,
        ai,
        previousChatHistory
    ) => {
        const newInteraction = `Human: ${human}\nAI: ${ai}`;
        if (!previousChatHistory) {
            return newInteraction;
        }
        return `${previousChatHistory}\n\n${newInteraction}`;
    };

    /**
     * Create a prompt template for generating an answer based on context and
     * a question.
     *
     * Chat history will be an empty string if it's the first question.
     *
     * inputVariables: ["chatHistory", "context", "question"]
     */
    const questionPrompt = PromptTemplate.fromTemplate(
        `Use the following pieces of context to answer the question at the end like an assistant trained to answer farming and finance questions related to farming only such as loans,credits, crop pattern. If you don't know the answer, just say that 'I am an AI model trained to answer finance and farming related questions only', don't try to make up an answer. 
  ----------------
  CONTEXT: {context}
  ----------------
  CHAT HISTORY: {chatHistory}
  ----------------
  QUESTION: {question}
  ----------------
  Helpful Answer:`
    );

    const chain = RunnableSequence.from([
        {
            question: (input) =>
                input.question,
            chatHistory: (input) =>
                input.chatHistory ?? "",
            context: async (input) => {
                const relevantDocs = await retriever.getRelevantDocuments(input.question);
                const serialized = formatDocumentsAsString(relevantDocs);
                return serialized;
            },
        },
        questionPrompt,
        model,
        new StringOutputParser(),
    ]);
    /**
     * {
     *   resultOne: 'The president thanked Justice Breyer for his service and described him as an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court.'
     * }
     */
    let result;
    if (previousChat) {
        result = await chain.invoke({
            chatHistory: previousChat,
            question: currentQuestion,
        });
    } else {
        result = await chain.invoke({
            question: currentQuestion,
        });
    }
    previousChat = formatChatHistory(currentQuestion, result, previousChat);
    res.send({ result });
})

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
})

