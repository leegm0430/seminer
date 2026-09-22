window.STORY_DATA = {
  "meta": {
    "title": "마지막 신호",
    "author": "",
    "styleTag": "",
    "tagline": "도시의 불빛이 꺼진 밤,\n아직 사라지지 않은 신호가 있다.\n당신의 선택은 어디로 이어질까.",
    "theme": "forest",
    "coverLabel": "SEOUL, 2033 / A STORY OF CHOICES"
  },
  "stats": {
    "체력": 100,
    "정신력": 30,
    "기본공격력": 10,
    "무기보정": 0,
    "공격력": 10,
    "적체력": 30
  },
  "statBounds": {
    "체력": {
      "min": 0,
      "max": 100
    },
    "정신력": {
      "min": 0,
      "max": 100
    },
    "적체력": {
      "min": 0,
      "max": 100
    }
  },
  "derivedStats": [
    {
      "target": "공격력",
      "source": "기본공격력",
      "factor": 1,
      "offset": 0,
      "bonus": "무기보정"
    }
  ],
  "startScene": "start",
  "classes": [
    {
      "id": "hacker",
      "name": "해커",
      "description": "해킹 스킬을 배울 수 있습니다.",
      "startingStats": {
        "정신력": 30
      }
    },
    {
      "id": "survivor",
      "name": "생존자",
      "description": "기본 공격력이 높습니다.",
      "startingStats": {
        "기본공격력": 15
      }
    }
  ],
  "items": [
    {
      "id": "blade",
      "name": "훈련용 검",
      "icon": "",
      "description": "무기보정이 5 증가한다.",
      "effect": {
        "무기보정": 5
      }
    },
    {
      "id": "medkit",
      "name": "응급 키트",
      "icon": "",
      "description": "처음 획득할 때 체력 20 회복.",
      "effect": {
        "체력": 20
      }
    },
    {
      "id": "card",
      "name": "출입 카드",
      "icon": "",
      "description": "서버실 문을 열 수 있다.",
      "effect": {}
    }
  ],
  "skills": [
    {
      "id": "hack",
      "name": "해킹",
      "icon": "",
      "requires": {
        "class": "hacker"
      }
    }
  ],
  "scenes": {
    "start": {
      "image": "",
      "text": "꺼진 모니터 사이로 희미한 초록빛이 새어 나온다. 누군가 이곳에 신호를 남겼다. 문 옆에는 오래된 검과 출입 카드가 놓여 있다. 둘 중 무엇을 가져갈까?",
      "choices": [
        {
          "label": "훈련용 검을 챙기고 복도로",
          "next": "hall",
          "grantItem": "blade"
        },
        {
          "label": "출입 카드를 챙기고 복도로",
          "next": "hall",
          "grantItem": "card"
        }
      ],
      "title": "깨어난 방"
    },
    "hall": {
      "image": "",
      "text": "복도 끝 서버실에서 낮은 기계음이 들린다. 닫힌 문 너머로 이어지는 신호. 단말기를 해독하거나, 출입 카드를 사용하거나, 파수꾼이 지키는 길을 택할 수 있다.",
      "choices": [
        {
          "label": "해킹 배우기 (해커 전용)",
          "next": "hall",
          "grantSkill": "hack"
        },
        {
          "label": "해킹으로 문 열기 · 정신력 10 소비",
          "next": "success",
          "requires": {
            "skill": "hack",
            "statAtLeast": {
              "정신력": 30
            }
          },
          "effects": {
            "정신력": -10
          }
        },
        {
          "label": "출입 카드로 문 열기",
          "next": "success",
          "requires": {
            "item": "card"
          }
        },
        {
          "label": "훈련 로봇과 대결",
          "next": "arena"
        },
        {
          "label": "준비실로 돌아가기",
          "next": "start"
        },
        {
          "label": "응급 키트 받기 (최초 1회 효과)",
          "next": "hall",
          "grantItem": "medkit"
        }
      ],
      "title": "닫힌 문 앞에서"
    },
    "arena": {
      "image": "",
      "text": "파수꾼의 눈에 붉은빛이 들어온다. 물러설 길은 아직 열려 있다. 앞으로 나아가려면, 남은 힘을 계산해야 한다.",
      "choices": [
        {
          "label": "공격 · 체력 10 소모",
          "next": "arena",
          "effects": {
            "체력": -10
          },
          "dynamicEffects": [
            {
              "target": "적체력",
              "source": "공격력",
              "factor": -1,
              "offset": 0
            }
          ]
        },
        {
          "label": "복도로 돌아가기",
          "next": "hall"
        }
      ],
      "title": "경계의 파수꾼"
    },
    "success": {
      "image": "",
      "text": "문이 열리고 도시의 불빛 하나가 다시 켜졌다. 당신이 따라온 작은 신호가, 누군가에게는 돌아갈 길이 되었다.",
      "choices": [],
      "title": "빛이 닿는 곳"
    },
    "failure": {
      "image": "",
      "text": "끝내 손끝에서 힘이 빠져나갔다. 하지만 선택은 여기서 끝나지 않는다. 같은 밤, 다른 길이 당신을 기다린다.",
      "choices": [],
      "title": "멈춰버린 시간"
    }
  },
  "endings": {
    "good": {
      "sceneId": "success",
      "title": "탈출 성공"
    },
    "bad": {
      "sceneId": "failure",
      "title": "다시 도전"
    }
  },
  "statEndings": [
    {
      "stat": "체력",
      "op": "lte",
      "value": 0,
      "endingId": "bad"
    },
    {
      "stat": "적체력",
      "op": "lte",
      "value": 0,
      "endingId": "good"
    }
  ]
};
