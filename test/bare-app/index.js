const http = require("http"); const s = http.createServer((req,res) => {res.writeHead(200); res.end("hello");}); s.listen(3000, () => console.log("listening on 3000"));
