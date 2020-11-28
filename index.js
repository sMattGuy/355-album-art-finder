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
const https = require('https');
const querystring = require('querystring');
const credentials = require('./auth/credentials.json');

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
		
		//create options and query information
		const post_data = {"grant_type":"client_credentials"};
		let base64data = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
		const headers = {"Content-Type":"application/x-www-form-urlencoded", "Authorization":`Basic ${base64data}`};
		const query = querystring.stringify(post_data);
		const options = {"method":'POST', "headers":headers};
		
		//parse authentication token responce
		function stream_to_message(stream, callback){
			let body = "";
			stream.on("data", (chunk) => body += chunk);
			stream.on("end", () => callback(body));
		}
		//creates authentication request
		checkAuthCache();
		//gets auth and converts to cache
		function received_authentication(auth_message, user_input, auth_sent_time, res){
			console.log("got auth");
			let spotify_auth = JSON.parse(auth_message);
			
			spotify_auth.expiration = auth_sent_time.setSeconds(auth_sent_time.getSeconds()+spotify_auth.expires_in);
			
			create_access_token_cache(spotify_auth);
			create_search_request(spotify_auth.access_token, user_input, res);
		}
		function create_access_token_cache(auth){
			let data = JSON.stringify(auth);
			fs.writeFile('./auth/authentication-res.json', data, (err) => {
				if(err) throw err;
				console.log("File written successfully");
			});
		}
		//end of caching auth
		
		//start of site code check if auth cache is expired
		function checkAuthCache(){
			const authentication_cache = './auth/authentication-res.json';
			let cache_valid = false;
			if(fs.existsSync(authentication_cache)){
				cached_auth = require(authentication_cache);
				const currentTime = Date.now();
				if(cached_auth.expiration > currentTime){
					cache_valid = true;
				}
			}
			if(cache_valid){
				create_search_request(cached_auth.access_token, user_input, res);
			}
			else{
				const token_endpoint = 'https://accounts.spotify.com/api/token';
				console.log("generating new auth");
				let auth_sent_time = new Date();
				let auth_req = https.request(token_endpoint, options);
				auth_req.on('error',error_handler);
				function error_handler(err){
					throw err;
				}
				auth_req.once('response', post_auth_cb);
				function post_auth_cb(incoming_msg_stream){
					stream_to_message(incoming_msg_stream, message => received_authentication(message, user_input, auth_sent_time, res));
				}
				auth_req.end(query);
			}
		}
		//end of site code expired checking
		
		//create search request
		function create_search_request(cached_auth, user_input, res){
			//query information
			const data = {"q":`${artist}`,"type":"album","access_token":`${cached_auth}`};
			const query = querystring.stringify(data);
			const requestData = `https://api.spotify.com/v1/search?${query}`;
			//https get request
			let image_req = https.get(requestData, function(image_res){
				stream_to_message(image_res, message => download(message, res));
			});
			image_req.on('error', function(err){console.log(err);});
			//download image function
			function download(message, res){
				let img_array = [];
				let downloaded_images = 0;
				const img_path = './album-art/';
				//convert to javascript object
				let image_json = JSON.parse(message);
				console.log("getting urls");
				for(let n in image_json.albums.items){
					//gets current photo url
					let current_url = image_json.albums.items[n].images[0].url;
					let filename = current_url.substring(current_url.lastIndexOf('/')+1);
					let filepath = `${img_path}${filename}.jpg`;
					img_array.push(`<img src="${filepath}" width="300"/>`);
					//check if file exists
					if(!fs.existsSync(filepath)){
						//get image request
						let image_req = https.get(current_url, function(image_res){
							//write image data to file
							let new_img = fs.createWriteStream(filepath,{'encoding':null});
							//pipe new image
							image_res.pipe(new_img);
							//when pipe finishs 
							new_img.on("finish",function(){
								downloaded_images++;
								//if all images done
								if(downloaded_images === image_json.albums.items.length){
									//call generate webpage
									generate_webpage(img_array, res);
								}
							});
						});
						image_req.on('error',function(err){console.log(err)});
					}
					//if image exists
					else{
						//skips and increments downloaded images
						downloaded_images++;
						if(downloaded_images === image_json.albums.items.length){
							generate_webpage(img_array, res);
						}
					}
				}
			}
			//end of download image
		}
		//end of create search request
		//generates webpage
		function generate_webpage(img_array, res){
			console.log("generating final page");
			res.writeHead(200, {"Content-Type": "text/html"});
			
			const images = img_array.join('');
			res.end(`<a href="./"> <img src="/favicon.ico" /></a><h1>Results for ${artist}</h1>${images}`);
		}
		//end of generate webpage
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
