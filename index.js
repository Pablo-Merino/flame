const log = (data) => {
  console.log(`[API] ${data}`)
}

const http = require('http');
const app = require('express')();
const busboy = require('connect-busboy');
const fs = require('fs');
const path = require('path');
const os = require('os');
const tar = require('tar-fs')
const DockerLib = require('dockerode');
const Handlebars = require('handlebars');

if(process.env.DEV) {
  const docker = new DockerLib({
    host:'192.168.99.100',
    port:2376,
    protocol: 'https',
    ca: fs.readFileSync('/Users/pablo/.docker/machine/certs/ca.pem'),
    cert: fs.readFileSync('/Users/pablo/.docker/machine/certs/cert.pem'),
    key: fs.readFileSync('/Users/pablo/.docker/machine/certs/key.pem')
  });
} else {
  const docker = new DockerLib({
    socketPath: '/var/run/docker.sock'
  });
}

const templateDockerfile = fs.readFileSync('./template_dockerfile')
const templateNginxConf = fs.readFileSync('./template_nginx').toString()

app.use(busboy())

var writeNginxConf = (data) => {
  var template = Handlebars.compile(templateNginxConf)
  var compiledConf = template(data);
  if(process.env.DEV) {
    log(compiledConf)
  } else {
    var nginxConfigPath = path.join('/var/flames/nginx/', `${data.appName}.conf`)
    fs.writeFile(nginxConfigPath, compiledConf, (err) => {
      log(`Nginx config written to ${nginxConfigPath}`)
    });

  }
}

const pushToDocker = (path, name, cb) => {
  var tarStream = tar.pack(path).pipe(fs.createWriteStream(`${path}.tar`))
  tarStream.on('finish', () => {
    log(`${path}.tar created!`)
    docker.buildImage(`${path}.tar`, {t: name}, function(err, stream) {
      if(err) return console.log(err);

      stream.on('data', (data) => {
        // lol wut
      }); 

      stream.on('end', function() {
        log(`${name} deployed to Docker!`)
        docker.run(name, [], null, {}, {
          'PortBindings': { 
            '8080/tcp': [{ 'HostPort': '9000' }]
          }
        }, (err, data, container) => {
          log(`${name} running!`);
          writeNginxConf({
            appName: name,
            appPort: 9000
          })
          cb(name)
        });
      });
    });
  })
}

const publishApp = (filePath, cb) => {
  var folderName = path.basename(filePath).replace('.tar', '')
  var saveTo = path.join(os.tmpDir(), new Date().getTime().toString());
  log(`Extracting app to ${saveTo}`)
  var stream = fs.createReadStream(filePath).pipe(tar.extract(saveTo))
  stream.on('finish', function () { 
    var parsedPackage = JSON.parse(fs.readFileSync(path.join(saveTo, folderName, 'package.json')))
    fs.writeFile(path.join(saveTo, folderName, 'Dockerfile'), templateDockerfile, (err) => {
      log(`Dockerfile written: ${path.join(saveTo, folderName, 'Dockerfile')}`)
      pushToDocker(path.join(saveTo, folderName), parsedPackage.name, cb)
    }); 
  });
}

app.post('/publish', (req, res) => {
  if(req.busboy) {
    req.pipe(req.busboy);
    req.busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      log(`Received file ${filename} (${fieldname})`)
      var saveTo = path.join(os.tmpDir(), path.basename(filename));
      log(`Saving to ${saveTo}`)
      file.pipe(fs.createWriteStream(saveTo));
      publishApp(saveTo, (name) => {
        res.json({ok: true, name: name})
      })
    });
  } else {
    log('Busboy not ready! :(')
    res.json({ok: false})
  }
});

http.createServer(app).listen(process.env.PORT || 3000, function() {
  log('Running!');
});