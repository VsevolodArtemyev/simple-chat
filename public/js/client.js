/**
 * Created by Всеволод on 08.09.2015.
 */
var currentUser = {
  alias: '',
  color: ''
};

var sessionBreak = false; // Признак разрыва сессии, если true - сервер разорвал соединение

// Вход в чат по клавише Enter и отправка сообщений по Shift+Enter
document.onkeypress = function (evt) {
  if (evt.keyCode == 13) {
    if (document.getElementById('fAuth').style.display == 'none') {
      if (!evt.shiftKey) return;

      evt.preventDefault();
      publish(document.getElementById('fChat').msg.value);
    } else {
      evt.preventDefault();
      auth(document.getElementById('fAuth').alias.value);
    }
  }
};

/**
 * Цитирование
 * @param {Node} elem - тег элемента, который содержит сообщение юзера
 */
function quotation (elem) {
  var _quot = elem.innerText.replace(new RegExp(String.fromCharCode(10), 'g'), '\n\> ');
  var _text = '> ' + elem.parentNode.firstChild.innerText + ': ' + _quot + '\n';
  document.getElementById('fChat').msg.value = _text;
  document.getElementById('fChat').msg.focus();
}

/**
 * Преобразование объекта JS в DOM
 * @param {Array} msgArray - массив объектов хранящих данные о сообщении и его отправителе
 * @return {boolean} true - если все успешно, false - если с сервера пришло сообщение с неизвестным типом
 */
function parseMessage (msgArray) {
  var _tag, _clientSpan, _output = document.getElementById('output');
  for (var i = 0; i < msgArray.length; i++) {
    _tag = document.createElement('div');
    _tag.className = 'msg';
    _clientSpan = '<span class = "alias" style = "color: ' + msgArray[i].color + '">' + msgArray[i].alias + '</span>'; // Псевдоним

    // Определение типа сообщения
    switch (msgArray[i].msgType) {
      case 0: // Стандартное сообщение
        var _msg = msgArray[i].msg.replace(new RegExp(String.fromCharCode(10), 'g'), '<br>'); // Парсинг символов переноса строки
        _tag.innerHTML = _clientSpan + ':<span onclick = "quotation(this)" class = "text">' + _msg + '</span>';
        break;
      case 1: // Присоединение к чату
        if (currentUser.alias == msgArray[i].alias)
          _tag.innerHTML = '<span class = "service-msg">Вы успешно присоединились к чату';
        else
          _tag.innerHTML = '<span class = "service-msg">Пользователь ' + _clientSpan + ' присоединился к чату';
        break;
      case 2: // Выход из чата
        _tag.innerHTML = '<span class = "service-msg">Пользователь ' + _clientSpan + ' покинул чат';
        break;
      default: return false;
    }
    _output.appendChild(_tag);
  }
  _output.scrollTop = _output.scrollHeight;
  return true;
}

/**
 * Обновление списка участников чата
 * @param {Array} clientsList - массив данных участников чата.
 */
function refreshUsersList (clientsList) {
  var _tag;
  document.getElementById('clientsList').innerHTML = '';

  for (var i = 0; i < clientsList.length; i++) {
    _tag = document.createElement('div');
    _tag.className = 'alias-in-list';
    _tag.style.color = clientsList[i].color;
    _tag.innerText = clientsList[i].alias;
    document.getElementById('clientsList').appendChild(_tag);
  }
}

/**
 * Оформление подписки на получение сообщений
 * @param {string} alias - псевдоним пользователя
 * @param {boolean} isNew - признак пользователя присоединишегося к чату
 */
function subscribe (alias, isNew) {
  var _sendData = isNew ? JSON.stringify({'alias': alias, 'isNew': true}) :
                          JSON.stringify({'alias': alias});

  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/sub', true);
  xhr.send(_sendData);

  xhr.onreadystatechange = function () {
    if (xhr.readyState != 4) return;

    if (xhr.status != 200) { // Обработка ошибок
      switch (this.status) {
        case 0: // Ошибка возникающая по окончании времени жизни запроса, либо при разрыве связи.
          if (sessionBreak) {
            alert ('Сервер разорвал соединение.');
            return;
          }
          subscribe (alias);

          // Установка признака разрыва сессии. Если соединение разорвано, следующий возврат ошибки соединения
          // сработает раньше, чем таймаут успеет выставить sessionBreak в false.
          sessionBreak = true;
          setTimeout (function () {
            sessionBreak = false;
          }, 1000);
          break;

        case 401:
          alert ('Необходимо пройти авторизацию');

          document.getElementById ('fChat').style.display = 'none';
          document.getElementById ('output').innerHTML = '';
          document.getElementById ('clientsList').innerHTML = '';

          document.getElementById ('fAuth').style.display = 'block';
          document.getElementById ('fAuth').alias.focus ();
          break;

        default:
          alert ('Ошибка: ' + this.responseText);
      }
    } else {
      var _data = JSON.parse(this.responseText);

      if (_data.clientsList) refreshUsersList(_data.clientsList);
      if (!parseMessage(_data.sendData)) alert ('Неизвестный формат сообщения');

      subscribe(alias);
    }
  }
}

/**
 * Аутентификация
 * @param {string} alias - псевдоним пользователя
 */
function auth (alias) {
  if (!alias) {
    alert('Необходимо ввести псевдоним');
    return;
  }

  var _alias = JSON.stringify({'alias': alias});

  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/connect', true);
  xhr.send(_alias);
  document.getElementById('fAuth').alias.value = '';

  xhr.onreadystatechange = function() {
    if (xhr.readyState != 4) return;

    if (xhr.status != 200) {
      alert (xhr.responseText);
    } else {
      currentUser.alias = alias;
      var _data = JSON.parse(xhr.responseText);

      // Переключение между авторизацией и окном чата
      document.getElementById('fAuth').style.display = 'none';
      document.getElementById('fChat').style.display = 'block';
      document.getElementById('fChat').msg.focus();

      // Парсинг истории сообщений и обновление списка участников
      parseMessage(_data.history);
      refreshUsersList(_data.clientsList);

      subscribe (currentUser.alias, true);
    }
  }
}

/**
 * Публикация сообщения
 * @param {string} message - сообщение написанное пользователем
 */
function publish (message) {
  if (message.length == 0) return;
  var _msg = JSON.stringify({alias: currentUser.alias, msg: message});

  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/pub', true);
  xhr.send(_msg);

  document.getElementById('fChat').msg.value = '';
  return false;
}