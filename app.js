/**
 * Module dependencies.
 */
var http = require('http');
var fs = require('fs');
var chat = require('./routes/chat');

/**
 * Чтение файла
 * @param {String} filename - имя файла
 * @param {ServerResponse} res - объект ответа сервера
 */
function getFile (filename, res) {
  var _file = new fs.ReadStream (filename);
  _file.pipe(res);

  _file.on ('error', function () {
    res.statusCode = 500;
    res.end ('Server Error');
  });

  // Обработчик на случай обрыва сессии. Очистка памяти
  res.on ('close', function () {
    _file.destroy();
  });
}

function readData (req, callback) {
  var _clientData = '';

  req.on('readable', function() {
    _clientData += req.read();
  }).on('end', function() {
    try {
      _clientData = JSON.parse(_clientData);
    } catch (e) {
      res.statusCode = 400;
      res.end("Некорректный запрос");
      return;
    }

    callback(_clientData);
  });

}

var server = http.createServer().listen('3000');

server.on ('request', function (req, res) {
  var _callback = null;

  switch (req.url) {
    case '/':
      getFile('public/index.html', res);
      break;

    case '/css/bootstrap.css':
      getFile('public/css/bootstrap.css', res);
      break;

    case '/js/client.js':
       getFile('public/js/client.js', res);
       break;

    case '/css/client.css':
       getFile('public/css/client.css', res);
       break;

    case '/connect': // Присоединение к чату
      _callback = function (data) {
        chat.auth(data.alias, res);
      };

      readData (req, _callback);
      break;

    case '/sub': // Подписка на сообщения
      _callback = function (data) {
        if (data.isNew)
          chat.subscribe(data.alias, res, data.isNew);
        else
          chat.subscribe(data.alias, res);
      };

      readData(req, _callback);
      break;

    case '/pub': // Публикация сообщений
      _callback = function (data) {
        chat.publish(data.alias, data.msg);
        res.end();
      };

      readData(req, _callback);
      break;

    default:
      res.statusCode = 404;
      res.end ('Not found!');
  }
});