#! /bin/bash
git pull
npm install
export PORT=3000
export GOOGLE_API_KEY=`aws ssm get-parameter --name "/KisanMitra/config/prod/GoogleAI/APIKey" --with-decryption --output text --query Parameter.Value`
export GOOGLE_CSE_ID=`aws ssm get-parameter --name "/KisanMitra/config/prod/GoogleAI/CSEId" --with-decryption --output text --query Parameter.Value`
export GOOGLE_PALM_API_KEY=`aws ssm get-parameter --name "/KisanMitra/config/prod/GoogleAI/PalMAPIKey" --with-decryption --output text --query Parameter.Value`
export OPENAI_API_KEY=`aws ssm get-parameter --name "/KisanMitra/config/prod/OpenAI/APIKey" --with-decryption --output text --query Parameter.Value`
export SERPAPI_API_KEY=`aws ssm get-parameter --name "/KisanMitra/config/prod/SerpAPI/APIKey" --with-decryption --output text --query Parameter.Value`
npm start
