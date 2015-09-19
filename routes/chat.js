/**
 * Created by Всеволод on 09.09.2015.
 */
var clients = [], // Массив текущих участников чата
    history = [], // История переписки
    colors = ['00', '33', '66', '99', 'CC', 'FF']; // Массив для генерации 'безопасных' цветов для псевдонимов

/**
 * Поиск клиента по псевдониму
 * @param {String} alias - псевдоним
 * @return {Object} объект с данными по найденному клиенту. В случае если клиент не найден вернется false
 */
function findClient (alias) {
  for (var i = 0; i < clients.length; i++)
    if (clients[i].alias == alias)
      return clients[i];

  return false;
}

/**
 * Получение списка клиентов
 * @return {Array} массив для передачи клиенту списка участников чата
 */
function getClientsList () {
  var _clientsList = [];
  for (var i = 0; i < clients.length; i++) {
    _clientsList.push({'alias': clients[i].alias, 'color': clients[i].color});
  }
  return _clientsList;
}

/**
 * Разрыв соединения с клиентом вышедшим из чата. Устанавливает таймаут на 2 секунды для того, чтобы исключить
 * событие истечения срока запроса на подписку. Таким образом сработает только если пользователь покинул чат.
 * @param {Object} client - объект хранящий данные по клиенту
 */
function sessionKiller (client) {
  client.killTime = setTimeout ( function () {
    clearTimeout(client.killTime);
    client.killTime = null;
    exports.publish(client.alias, '', 2);
  }, 2000);
}

/**
 * Авторизация пользователя
 * @param {String} alias - псевдоним пользователя
 * @param {ServerResponse} res - объект ответа сервера
 */
exports.auth = function (alias, res) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  var _color = '#'; // Цвет, который будет генерироваться для раскраски псевдонима пользователя в чате

  for (var j = 0; j < 3; j++)
    _color += colors[Math.floor(Math.random() * colors.length)];

  if (clients.length == 0) {// Если присоединяется первый клиент
    clients.push ({'alias': alias, 'color': _color, 'resInst': null});
 } else {
    if (findClient (alias)) {
      console.log ('user exists');

      res.statusCode = 7;
      res.end ('Пользователь с таким псевдонимом уже существует');
      return;
    } else {
      clients.push ({'alias': alias, 'color': _color, 'resInst': null});
    }
  }

  res.end(JSON.stringify({'color': _color, 'history': history, 'clientsList': getClientsList()}));
};

/**
 * Подписка на сообщения
 * @param {String} alias - псевдоним пользователя
 * @param {ServerResponse} res - объект ответа сервера
 * @param {Boolean} isNew - признак нового подключившегося клиента (необязательный)
 */
exports.subscribe = function(alias, res, isNew) {
  //console.log("subscribe");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  var _client = findClient(alias);
  if (!_client) { // Если клиент не авторизован
    console.log ('auth error ' + alias);
    res.statusCode = 401;
    res.end (null);
    return;
  } else {
    if (_client.killTime) { // Если клиент повторил запрос на подписку после истечения срока пред. запроса
      clearTimeout(_client.killTime);
      delete _client.killTime;
    }
    _client.resInst = res;
    if (isNew) exports.publish(alias, '', 1); // Если новый клиент вошел в чат, рассылаем уведомления
  }

  // Обработка на случай разрыва сессии или выхода времени запроса.
  res.on('close', function() {
    console.log ('close connection with ' + alias);
    sessionKiller(_client); // Установка таймера на исключение клиента из списка.
  });
};

/**
 * Публикация сообщений в чат
 * @param {String} alias - псевдоним отправителя сообщения
 * @param {String} message - сообщение
 * @param {int} msgType - тип сообщения (необязательный, по умолчанию 0):
 *                        0 - стандартное текстовое сообщение
 *                        1 - вход нового участника в чат
 *                        2 - выход одного из участниво
 */
exports.publish = function(alias, message, msgType) {
  //console.log('publish ' + message);
  var _publisher = findClient(alias),
      _msgType = msgType ? msgType : 0,

      _sendData = [{ // Объект заключен в массив для корректной обработки на стороне клиента
        'alias': _publisher.alias,
        'color': _publisher.color,
        'msg': message,
        'msgType': _msgType
      }];

  var _resObj = {};

  // Если возвращается сообщение о том, что клиент покинул чат, необходимо удалить его из массива участников
  if (_msgType != 0) {
    if (_msgType == 2) clients.splice(clients.indexOf(_publisher), 1);
    // Если публикуется сообщение о входе или выходе участника чата, добавляем обновленный список пользователей
    _resObj = JSON.stringify({
      'clientsList': getClientsList(),
      'sendData': _sendData
    });
  } else {
    _resObj = JSON.stringify({'sendData': _sendData});
    history.push(_sendData[0]);
  }

  clients.forEach(function(client) {
    // Для исключения случая, когда публикация сообщения происходит между авторизацией и подпиской нового пользователя
    if (client.resInst) {
      console.log('send to client ' + client.alias);
      client.resInst.end(_resObj);
      client.resInst = null;
    }
  });
};