import dotenv from 'dotenv'
import express from 'express'
import * as fs from "fs";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PromptTemplate } from "langchain/prompts";
import { formatDocumentsAsString } from "langchain/util/document";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentExecutor } from "langchain/agents";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { RunnableSequence } from "langchain/schema/runnable";
import { BufferMemory } from "langchain/memory";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { renderTextDescription } from "langchain/tools/render";
import { ReActSingleInputOutputParser } from "langchain/agents/react/output_parser";


dotenv.config();
const app = express()

app.use(express.json());

const memory = new BufferMemory({ memoryKey: "chat_history" });
//TRAINING DOCUMENT
const text = fs.readFileSync("bank.txt", "utf8");
/* Split the text into chunks */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
/* Create the vectorstore */
const vectorStore = await MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings());
const retriever = vectorStore.asRetriever();

app.get('/', async (req, res) => {
    const currentQuestion = req.body.question;
    /** Define your chat model */
    const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 150, openAIApiKey: process.env.OPENAI_API_KEY });
    /** Bind a stop token to the model */
    const modelWithStop = model.bind({
        stop: ["\nObservation"],
    });
    /** Define your list of tools */
    const tools = [
        new SerpAPI(process.env.SERPAPI_API_KEY, {
            location: "India",
            hl: "en",
            gl: "in",
        }),
        new Calculator(),
    ];

    /** Add input variables to prompt */
    let prompt = `Assistant is a large language model trained by OpenAI.

            Assistant is designed to be able to assist with a wide range of doubts related to farming, from answering simple questions to providing in-depth explanations and discussions on a wide range of topics related to farming alone. As a language model, Assistant is able to generate human-like text based on the input it receives, allowing it to engage in natural-sounding conversations and provide responses that are coherent and relevant to the only farming and finance related questions to farming at hand.

            Assistant is constantly learning and improving, and its capabilities are constantly evolving. It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses to a wide range of questions. Additionally, Assistant is able to generate its own text based on the input it receives, allowing it to engage in discussions and provide explanations and descriptions on a wide range of farming information.

            Overall, Assistant is a powerful tool that can help with a wide range of questions on farming and finance and provide valuable insights and information on a wide range of farming topics. Whether you need help with a specific question or just want to have a conversation about a particular topic, Assistant is here to assist.

            CONTEXT:
            ------
            
            {context}

            TOOLS:
            ------

            Assistant has access to the following tools:

            {tools}

            To use a tool, please use the following format:

            \\
            Thought: Do I need to use a tool? Yes
            Action: the action to take, should be one of [{tool_names}]
            Action Input: the input to the action
            Observation: the result of the action
            \\

            When you have a response to say to the Human, or if you do not need to use a tool, you MUST use the format:

            \\
            Thought: Do I need to use a tool? No
            Final Answer: [your response here]
            \\

            Begin!

            Previous conversation history:
            {chat_history}

            New input: {input}
            {agent_scratchpad}`

    prompt = prompt.replace(/\\/g, "```");
    const promptTemp = PromptTemplate.fromTemplate(prompt);

    const toolNames = tools.map((tool) => tool.name);
    const promptWithInputs = await promptTemp.partial({
        tools: renderTextDescription(tools),
        tool_names: toolNames.join(","),
    });




    const runnableAgent = RunnableSequence.from([
        {
            input: (i) => i.input,
            agent_scratchpad: (i) => formatLogToString(i.steps),
            chat_history: (i) => i.chat_history,
            context: async (i) => {
                const relevantDocs = await retriever.getRelevantDocuments(i.input);
                const serialized = formatDocumentsAsString(relevantDocs);
                return serialized;
            },
        },
        promptWithInputs,
        modelWithStop,
        new ReActSingleInputOutputParser({ toolNames }),
    ]);
    /**
     * Define your memory store
     * @important The memoryKey must be "chat_history" for the chat agent to work
     * because this is the key this particular prompt expects.
     */

    /** Define your executor and pass in the agent, tools and memory */
    const executor = AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        tools,
        memory,
        verbose: true,
    });

    const result = await executor.call({ input: currentQuestion });
    res.send({ result });
})

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
})

