/*
  StoryEngine
  - index.html(플레이어)과 editor.html(미리보기)이 공통으로 사용하는 엔진.
  - story-data.js에 정의된 STORY_DATA 형식을 읽어서 화면을 그리고 진행을 처리한다.
  - 사용법: StoryEngine.init(containerElement, storyData)
*/
(function (global) {
  'use strict';

  function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function meetsRequirement(requires, state) {
    if (!requires) return true;
    if (requires.item && state.inventory.indexOf(requires.item) === -1) return false;
    if (requires.skill && state.skills.indexOf(requires.skill) === -1) return false;
    if (requires.class && state.classId !== requires.class) return false;
    if (requires.statAtLeast) {
      for (var k in requires.statAtLeast) {
        if ((state.stats[k] || 0) < requires.statAtLeast[k]) return false;
      }
    }
    return true;
  }

  function applyEffects(effects, state) {
    if (!effects) return;
    for (var k in effects) {
      state.stats[k] = (state.stats[k] || 0) + effects[k];
    }
  }

  function resolveGrant(grant) {
    if (!grant) return [];
    if (Array.isArray(grant)) return grant;
    if (typeof grant === 'object') {
      if (grant.random && grant.random.length) {
        var idx = Math.floor(Math.random() * grant.random.length);
        return [grant.random[idx]];
      }
      return [];
    }
    return [grant];
  }

  function grantList(grant, list) {
    resolveGrant(grant).forEach(function (id) {
      if (list.indexOf(id) === -1) list.push(id);
    });
  }

  function encodeSave(state) {
    var payload = {
      sceneId: state.sceneId,
      classId: state.classId,
      classChosen: state.classChosen,
      stats: state.stats,
      inventory: state.inventory,
      skills: state.skills
    };
    var json = JSON.stringify(payload);
    var bytes = new TextEncoder().encode(json);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decodeSave(code) {
    var binary = atob(code);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  }

  function findEndingBySceneId(data, sceneId) {
    if (!data.endings) return null;
    for (var id in data.endings) {
      if (data.endings[id].sceneId === sceneId) {
        var e = cloneDeep(data.endings[id]);
        e.id = id;
        return e;
      }
    }
    return null;
  }

  function byId(list, id) {
    return (list || []).filter(function (x) { return x.id === id; })[0];
  }

  function init(container, data) {
    var state = {
      started: false,
      sceneId: null,
      classId: null,
      classChosen: false,
      stats: cloneDeep(data.stats || {}),
      inventory: [],
      skills: []
    };

    function resetState() {
      state.started = true;
      state.sceneId = null;
      state.classId = null;
      state.classChosen = false;
      state.stats = cloneDeep(data.stats || {});
      state.inventory = [];
      state.skills = [];
    }

    function promptSave() {
      var code = encodeSave(state);
      window.prompt('아래 저장 코드를 복사해서 보관하세요 (Ctrl+C 후 Enter):', code);
    }

    function promptLoad() {
      var code = window.prompt('저장 코드를 붙여넣으세요:', '');
      if (!code) return;
      try {
        var restored = decodeSave(code.trim());
        state.sceneId = restored.sceneId;
        state.classId = restored.classId;
        state.classChosen = restored.classChosen;
        state.stats = restored.stats;
        state.inventory = restored.inventory;
        state.skills = restored.skills;
        state.started = true;
        render();
      } catch (e) {
        window.alert('저장 코드를 읽을 수 없습니다. 코드가 정확한지 확인해주세요.');
      }
    }

    function render() {
      if (!state.started) {
        renderLanding();
      } else if (data.classes && data.classes.length > 0 && !state.classChosen) {
        renderClassSelect();
      } else {
        renderScene(state.sceneId || data.startScene || 'start');
      }
    }

    function renderLanding() {
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'se-landing';
      var h = document.createElement('h1');
      h.textContent = (data.meta && data.meta.title) || '스토리게임';
      wrap.appendChild(h);

      var startBtn = document.createElement('button');
      startBtn.className = 'se-choice';
      startBtn.textContent = '새로 시작하기';
      startBtn.onclick = function () {
        state.started = true;
        render();
      };
      wrap.appendChild(startBtn);

      var loadBtn = document.createElement('button');
      loadBtn.className = 'se-choice';
      loadBtn.textContent = '저장 코드로 이어하기';
      loadBtn.onclick = promptLoad;
      wrap.appendChild(loadBtn);

      container.appendChild(wrap);
    }

    function renderClassSelect() {
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'se-class-select';
      var h = document.createElement('h2');
      h.textContent = '직업을 선택하세요';
      wrap.appendChild(h);
      data.classes.forEach(function (c) {
        var btn = document.createElement('button');
        btn.className = 'se-class-btn';
        btn.innerHTML = '<strong>' + escapeHtml(c.name) + '</strong><br><span>' + escapeHtml(c.description || '') + '</span>';
        btn.onclick = function () {
          state.classId = c.id;
          state.classChosen = true;
          if (c.startingStats) {
            for (var k in c.startingStats) state.stats[k] = c.startingStats[k];
          }
          render();
        };
        wrap.appendChild(btn);
      });
      container.appendChild(wrap);
    }

    function renderHeader() {
      var header = document.createElement('div');
      header.className = 'se-header';

      var statsEl = document.createElement('div');
      statsEl.className = 'se-stats';
      for (var k in state.stats) {
        var span = document.createElement('span');
        span.className = 'se-stat';
        span.textContent = k + ': ' + state.stats[k];
        statsEl.appendChild(span);
      }
      header.appendChild(statsEl);

      var invEl = document.createElement('div');
      invEl.className = 'se-inventory';
      state.inventory.forEach(function (id) {
        var item = byId(data.items, id);
        if (!item) return;
        var iconWrap = document.createElement('span');
        iconWrap.className = 'se-item-icon';
        iconWrap.title = item.name;
        if (item.icon) {
          var img = document.createElement('img');
          img.src = 'images/' + item.icon;
          img.alt = item.name;
          iconWrap.appendChild(img);
        } else {
          iconWrap.textContent = item.name;
        }
        invEl.appendChild(iconWrap);
      });
      header.appendChild(invEl);

      var saveLoadEl = document.createElement('div');
      saveLoadEl.className = 'se-saveload';
      var saveBtn = document.createElement('button');
      saveBtn.className = 'se-mini-btn';
      saveBtn.textContent = '\uD83D\uDCBE 저장';
      saveBtn.onclick = promptSave;
      var loadBtnHeader = document.createElement('button');
      loadBtnHeader.className = 'se-mini-btn';
      loadBtnHeader.textContent = '\u23EA 불러오기';
      loadBtnHeader.onclick = promptLoad;
      saveLoadEl.appendChild(saveBtn);
      saveLoadEl.appendChild(loadBtnHeader);
      header.appendChild(saveLoadEl);

      return header;
    }

    function renderError(msg) {
      container.innerHTML = '';
      var errWrap = document.createElement('div');
      errWrap.className = 'se-error';
      errWrap.textContent = '\u26A0 ' + msg;
      container.appendChild(errWrap);
    }

    function renderScene(sceneId) {
      var scene = (data.scenes || {})[sceneId];
      if (!scene) {
        renderError('씬을 찾을 수 없습니다: "' + sceneId + '" (연결이 끊어졌을 수 있어요. 에디터에서 이 씬을 참조하는 선택지를 확인하세요.)');
        return;
      }
      state.sceneId = sceneId;

      var ending = findEndingBySceneId(data, sceneId);
      var wrap = document.createElement('div');
      wrap.className = 'se-game';
      wrap.appendChild(renderHeader());

      if (ending) {
        // 엔딩은 씬 이미지와 엔딩 영상이 따로 겹쳐 보이지 않도록, 하나의 화면으로 합쳐서 그린다.
        // 우선순위: 엔딩 전용 영상 > 엔딩 전용 이미지 > (둘 다 없으면) 이 씬 자체의 이미지
        var endWrap = document.createElement('div');
        endWrap.className = 'se-ending';

        var endMediaEl = null;
        if (ending.video) {
          endMediaEl = document.createElement('video');
          endMediaEl.src = 'videos/' + ending.video;
          endMediaEl.controls = true;
          endMediaEl.autoplay = true;
          endMediaEl.className = 'se-video';
        } else if (ending.image) {
          endMediaEl = document.createElement('img');
          endMediaEl.src = 'images/' + ending.image;
          endMediaEl.className = 'se-image';
          endMediaEl.alt = '';
        } else if (scene.image) {
          endMediaEl = document.createElement('img');
          endMediaEl.src = 'images/' + scene.image;
          endMediaEl.className = 'se-image';
          endMediaEl.alt = '';
        }
        if (endMediaEl) endWrap.appendChild(endMediaEl);

        var endTitle = document.createElement('h2');
        endTitle.textContent = '\uD83C\uDFC1 ' + (ending.title || '엔딩');
        endWrap.appendChild(endTitle);

        if (scene.text) {
          var endText = document.createElement('p');
          endText.className = 'se-text';
          endText.textContent = scene.text;
          endWrap.appendChild(endText);
        }

        var restartBtn = document.createElement('button');
        restartBtn.className = 'se-choice';
        restartBtn.textContent = '처음부터 다시 시작';
        restartBtn.onclick = function () {
          resetState();
          render();
        };
        endWrap.appendChild(restartBtn);

        wrap.appendChild(endWrap);
        container.innerHTML = '';
        container.appendChild(wrap);
        return;
      }

      // 일반 씬(분기)
      var mediaEl = null;
      var skipBtn = null;
      var hasGatingVideo = !!scene.video;

      if (scene.video) {
        mediaEl = document.createElement('video');
        mediaEl.src = 'videos/' + scene.video;
        mediaEl.controls = true;
        mediaEl.autoplay = true;
        mediaEl.className = 'se-video';
      } else if (scene.image) {
        mediaEl = document.createElement('img');
        mediaEl.src = 'images/' + scene.image;
        mediaEl.className = 'se-image';
        mediaEl.alt = '';
      }

      var textEl = document.createElement('p');
      textEl.className = 'se-text';
      textEl.textContent = scene.text || '';

      var choicesWrap = document.createElement('div');
      choicesWrap.className = 'se-choices';
      (scene.choices || []).forEach(function (choice) {
        var ok = meetsRequirement(choice.requires, state);
        var btn = document.createElement('button');
        btn.className = 'se-choice' + (ok ? '' : ' se-choice-disabled');
        btn.textContent = choice.label;
        if (!ok) {
          btn.disabled = true;
          btn.title = '필요 조건을 만족하지 않았습니다';
        } else {
          btn.onclick = function () {
            applyEffects(choice.effects, state);
            grantList(choice.grantItem, state.inventory);
            grantList(choice.grantSkill, state.skills);
            renderScene(choice.next);
          };
        }
        choicesWrap.appendChild(btn);
      });

      if (hasGatingVideo) {
        choicesWrap.style.display = 'none';
        skipBtn = document.createElement('button');
        skipBtn.className = 'se-skip';
        skipBtn.textContent = '\u23ED 건너뛰기';
        var reveal = function () {
          choicesWrap.style.display = 'flex';
          skipBtn.style.display = 'none';
        };
        skipBtn.onclick = reveal;
        mediaEl.addEventListener('ended', reveal);
        mediaEl.addEventListener('error', reveal);
      }

      if (mediaEl) wrap.appendChild(mediaEl);
      if (skipBtn) wrap.appendChild(skipBtn);
      wrap.appendChild(textEl);
      wrap.appendChild(choicesWrap);

      container.innerHTML = '';
      container.appendChild(wrap);

    }

    render();

    return {
      reset: function () {
        resetState();
        render();
      },
      getState: function () {
        return cloneDeep(state);
      }
    };
  }

  global.StoryEngine = { init: init };
})(window);
