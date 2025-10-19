# TCSS460 web api server

Documentation at [api docs](https://tcss460-api.onrender.com/api-docs)

## Running api locally
- `cd server/`
-  setup .env file in `server/`
- `npm run dev` (dev) or `npm run build; npm run start` (prod)
- `curl -X 'GET' 'https://localhost:3000/api/api-info' -H 'accept: application/json'`
- profit??

## ENV file format

```
NODE_ENV=development
SERVER_PORT=3000

DB_URL=postgresql://...
```
