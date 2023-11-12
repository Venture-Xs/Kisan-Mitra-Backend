import * as fs from "fs";
import dotenv from "dotenv";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GooglePaLMEmbeddings } from "langchain/embeddings/googlepalm";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PromptTemplate } from "langchain/prompts";
import { formatDocumentsAsString } from "langchain/util/document";
import { GooglePaLM } from "langchain/llms/googlepalm";
// import { GoogleVertexAI } from "langchain/llms/googlevertexai";
import { AgentExecutor, initializeAgentExecutorWithOptions } from "langchain/agents";
import { GoogleCustomSearch, SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { RunnableSequence } from "langchain/schema/runnable";
import { BufferMemory } from "langchain/memory";
import { formatLogToString } from "langchain/agents/format_scratchpad/log";
import { renderTextDescription } from "langchain/tools/render";
import { ReActSingleInputOutputParser } from "langchain/agents/react/output_parser";
import { ChatOpenAI } from "langchain/chat_models/openai";


dotenv.config();

const memory = new BufferMemory({ memoryKey: "chat_history" });
//TRAINING DOCUMENT
const text = fs.readFileSync("bank.txt", "utf8");
/* Split the text into chunks */
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);
/* Create the vectorstore */
const vectorStore = await MemoryVectorStore.fromDocuments(docs, new GooglePaLMEmbeddings());
const retriever = vectorStore.asRetriever();


const Farmerbot = async (req, res) => {
    if (!req.params.prompt) {
        res.send({ result: "Please enter a question" })
    }
    const currentQuestion = req.params.prompt;
    /** Define your chat model */
    const model = new ChatOpenAI({ modelName: 'gpt-3.5-turbo-1106', verbose: true, temperature: 1 });

    model.bind({ stop: ["\nObservation"] })
    /** Bind a stop token to the model */
    const modelWithStop = model.bind({
        stop: ["\nObservation"],
    });
    /** Define your list of tools */
    const tools = [
        new GoogleCustomSearch(),
        // new SerpAPI(process.env.SERPAPI_API_KEY, {
        //     location: "India",
        //     hl: "en",
        //     gl: "in",
        // }),
    ];

    /** Add input variables to prompt */
    let prompt = `
            Assistant is a large language model trained by Google WHICH MUST ALWAYS GIVE ANSWERS WITH RESPECT TO YEAR 2023 ( the latest data ) and Indian database ( Rupee as currency ).

            Assistant is designed to be able to assist with a wide range of doubts related to farming, from answering simple questions to providing in-depth explanations and discussions on a wide range of topics related to farming alone. As a language model, Assistant is able to generate human-like text based on the input it receives, allowing it to engage in natural-sounding conversations and provide responses that are coherent and relevant to the only farming and finance related questions to farming at hand.

            Assistant is constantly learning and improving, and its capabilities are constantly evolving. It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses to a wide range of questions. Additionally, Assistant is able to generate its own text based on the input it receives, allowing it to engage in discussions and provide explanations and descriptions on a wide range of farming information.

            Overall, Assistant is a powerful tool that can help with a wide range of questions on farming and finance and provide valuable insights and information on a wide range of farming topics. Whether you need help with a specific question or just want to have a conversation about a particular topic, Assistant is here to assist.

            DO NOT ANSWER ANY QUESTION WHICH IS NOT FARMING OR FINANCE BASED , IF QUESTION IS NOT FARMING OR FINANCE RELATED , PLEASE USE THE FOLLOWING FORMAT TO ASK THE QUESTION AGAIN: ' I an AI bot trained to answer farming related questions only, please ask me a farming related question only. '

            TOOLS:
            ------

            Assistant has access to the following tools  :

            {tools}

            To use a tool , MUST use the following format , NEVER USE IT FOR ANYTHING ELSE:

            \\
            Thought: Do I need to use a tool? Yes
            Action: the action to take, should be one of [{tool_names}]
            Action Input: the input to the action
            Observation: the result of the action
            \\

            When you have a response to say to the Human, or if you do not need to use a tool, you MUST use this format ALONE and NO OTHER FORMAT MUST BE USED WITH IT OR ALONE FOR FINAL ANSWER :

            \\
            Thought: Do I need to use a tool? No
            Final Answer: [your response here]
            \\
            ------

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
        handleParsingErrors: (e) => {
            console.log(e)
            return "";
        }
    });

    const result = await executor.call({ input: currentQuestion });
    res.send({ result });
}

let previousChat = "";

const Financebot = async (req, res) => {
    const bankName = req.params.bankName;
    const currentQuestion = req.params.prompt;
    console.log(currentQuestion);
    /* Initialize the LLM to use to answer the question */
    const model = new GooglePaLM({});

    //TRAINING DOCUMENT
    const text = fs.readFileSync(`${bankName}.txt`, "utf8");
    /* Split the text into chunks */
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
    const docs = await textSplitter.createDocuments([text]);
    /* Create the vectorstore */
    const vectorStore = await MemoryVectorStore.fromDocuments(docs, new GooglePaLMEmbeddings());
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
        `
        Assistant is a large language model trained to answer Banking queries by Google.

        Assistant is designed to be able to assist with a wide range of doubts related to finance ( for farmers ), from answering simple questions to providing in-depth explanations and discussions on a wide range of topics related to farming alone. As a language model, Assistant is able to generate human-like text based on the input it receives, allowing it to engage in natural-sounding conversations and provide responses that are coherent and relevant to the only finance related questions.

        Assistant is constantly learning and improving, and its capabilities are constantly evolving. It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses to a wide range of questions. Additionally, Assistant is able to generate its own text based on the input it receives, allowing it to engage in discussions and provide explanations and descriptions on a wide range of finance information for farmers benefit.

        Overall, Assistant is a powerful tool that can help with a wide range of questions on finance and provide valuable insights and information on a wide range of finance. Whether you need help with a specific question or just want to have a conversation about a particular topic, Assistant is here to assist.


        Use the following pieces of context to answer the question at the end like an assistant trained to answer banking and related finance questions alone and no other informations related to farming only such as loans,credits, crop pattern. If you don't know the answer, just say that 'I am an AI model trained to answer finance related questions only', don't try to make up an answer. 
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
}

const getCredit = async (req, res) => {
    const location = req.query.location;
    const land = req.query.land;
    const asset = req.params.asset;
    const annincome = req.query.annincome;
    const crops = req.query.crops;
    const govtScheme = req.query.govtScheme;

    const chat = new GooglePaLM({ temperature: 1 });
    const prompt = `
    THE BOT IS TRAINED PREDICT A SCORE FOR FARMERS OUT OF 10 TO ANALYSE RISK OF GIVING THEM LOANS
    IMPORTANT THE RESPONSE SHOULD ONLY CONTAIN A SINGLE FLOATING POINT VALUE OUT OF 10.0

    Use the following inputs:
    location: ${location}
    land: ${land} owned
    asset: ${asset} worth in lakhs rupees
    annual income: ${annincome} in lakh rupees
    crops: ${crops} grown as string separated by commas
    govt scheme: ${govtScheme} availed by the farmer in the past

    conditions :

    People with hight land assests , income , crops and govt schemes availed are more likely to get loans
    whereas people with low land assests , income , crops and govt schemes availed are less likely to get loans
    government schemes are given less importance than other factors
    land assests are given more importance than other factors
    income is given more importance than other factors
    crops are given more importance than other factors

    THE RESPONSE SHOULD DEPEND ON THE ABOVE FACTORS , YOU CAN TAKE ASSUMPTIONS
    //
        [response in float]
    //
    `;

    const promptFormatted = prompt.replace(/\\/g, "```");
    const result = await chat.call(promptFormatted);
    res.send({ result });
}

export { Farmerbot, Financebot, getCredit }