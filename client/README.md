# Client

## Searching in the browser

You can use bloop in the browser, without running the Tauri app. First follow [the steps](./../server/README.md) to install and run the search server. Make sure that `API_URL` is set in `.env` (e.g. `API_URL=http://localhost:7878`). Then, in the root directory run:

```
npm install
npm run start-web
```

Open `localhost:5173` in a browser and, hey presto, you've got bloop in the browser.
