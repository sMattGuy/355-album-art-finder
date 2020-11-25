/*
=-=-=-=-=-=-=-=-=-=-=-=-
Album Art Search
=-=-=-=-=-=-=-=-=-=-=-=-
Student ID:
Comment (Required):

=-=-=-=-=-=-=-=-=-=-=-=-
*/
const fs = require('fs');
const url = require("url");
const http = require('http');
const port = 3000;
const server = http.createServer();

server.on("request", connection_handler);
function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
	if(req.url === "/"){
		const main = fs.createReadStream("html/main.html");
        res.writeHead(200, {"Content-Type": "text/html"});
        main.pipe(res);
    }
	else if (req.url === "/favicon.ico"){
		const icon = fs.createReadStream("images/favicon.ico");
        res.writeHead(200, {"Content-Type": "image/x-icon"});
		icon.pipe(res);
    }
	else if (req.url === "/images/banner.jpg"){
        res.writeHead(200, {"Content-Type": "image/jpeg"});
        const image_stream = fs.createReadStream("images/banner.jpg");
		image_stream.pipe(res);
    }
	else if (req.url.startsWith("/album-art/")){
        let image_stream = fs.createReadStream(`.${req.url}`);
		image_stream.on("error",image_error_handler);
		function image_error_handler(err){
			res.writeHead(404, {"Content-Type":"text/plain"});
			res.write("404 Not Found", () => res.end());
		}
		image_stream.on("ready", deliver_image);
		function deliver_image(){
			res.writeHead(404, {"Content-Type":"text/plain"});
			image_stream.pipe(res);
		}
    }
	else if (req.url.startsWith("/search")){
        const user_input = url.parse(req.url, true).query;
		const artist = user_input.artist;
		console.log(`${artist}`);
		
    }
    else{
        res.writeHead(404, {"Content-Type": "text/html"});
        res.end(`<h1>404 Not Found</h1>`);
    }
}

server.on("listening", listening_handler);
function listening_handler(){
	console.log(`Now Listening on Port ${port}`);
}

server.listen(port);
