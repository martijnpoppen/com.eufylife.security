const Homey = require('homey');
const static = require('node-static');
const http = require('http');

exports.init = async function () {
    try {
        const port = 39828;
        const file = new(static.Server)(__dirname);

        const server = await http.createServer(function (req, res) {
          file.serve(req, res);
        });

        await server.listen(port);

        server.on('error', console.log)

        return port;
    } catch (error) {
        Homey.app.log(error);
    }
}