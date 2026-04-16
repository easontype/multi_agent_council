@echo off
cd /d D:\council
echo Starting Council dev server on http://localhost:3001
start http://localhost:3001
npx next dev -p 3001
