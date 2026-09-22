window.STORY_DATA = {
  "meta": {
    "title": "회색 비",
    "author": "leegm0430",
    "styleTag": "post-apocalyptic Seoul, ash-grey palette, desaturated muted tones, gritty hand-painted concept art, overcast lighting, fine ash particles in the air"
  },
  "stats": {
    "체력": 100,
    "정신력": 100
  },
  "startScene": "scene01",
  "classes": [
    {
      "id": "class_engineer",
      "name": "기관사 출신",
      "description": "사고 전, 도윤은 지하철 2호선 기관사였다. 지하 노선과 구조물을 몸으로 기억하고 있다.",
      "startingStats": {
        "체력": 110,
        "정신력": 100
      }
    },
    {
      "id": "class_medic",
      "name": "의료보조원 출신",
      "description": "사고 전, 도윤은 병원 응급실 보조 인력이었다. 다친 사람을 다루는 손이 여전히 침착하다.",
      "startingStats": {
        "체력": 100,
        "정신력": 110
      }
    }
  ],
  "items": [
    {
      "id": "item_medkit",
      "name": "상비약 키트",
      "icon": "item_medkit.png",
      "effect": {
        "체력": 20
      }
    },
    {
      "id": "item_family_photo",
      "name": "가족사진",
      "icon": "item_family_photo.png",
      "effect": {
        "정신력": 10
      }
    },
    {
      "id": "item_radio",
      "name": "청소부 무전기",
      "icon": "item_radio.png",
      "effect": {
        "정신력": -5
      }
    },
    {
      "id": "item_gasmask",
      "name": "방독마스크",
      "icon": "item_gasmask.png",
      "effect": {}
    }
  ],
  "skills": [
    {
      "id": "skill_underground_sense",
      "name": "지하 노선 감각",
      "icon": "skill_underground_sense.png",
      "requires": {
        "class": "class_engineer"
      }
    },
    {
      "id": "skill_first_aid",
      "name": "응급처치",
      "icon": "skill_first_aid.png",
      "requires": {
        "class": "class_medic"
      }
    }
  ],
  "scenes": {
    "scene01": {
      "image": "Scene1.png",
      "video": null,
      "text": "정전된 을지로3가역 승강장, 모닥불 곁에서 낡은 라디오에 구조 방송이 잡힌다. \"72시간 뒤 남산 송신탑 헬기장으로 구조 헬기가 온다.\" 은신처 사람들은 반신반의하고, 도윤은 직접 확인하겠다며 자리에서 일어선다.",
      "textByClass": {
        "class_engineer": "정전된 을지로3가역 승강장, 모닥불 곁에서 낡은 라디오에 구조 방송이 잡힌다. \"72시간 뒤 남산 송신탑 헬기장으로 구조 헬기가 온다.\" 사고 전 이 노선을 몰던 기관사였던 도윤은, 지하 구조물이라면 몸이 먼저 기억한다는 걸 안다. 그는 직접 확인하겠다며 자리에서 일어선다.",
        "class_medic": "정전된 을지로3가역 승강장, 모닥불 곁에서 낡은 라디오에 구조 방송이 잡힌다. \"72시간 뒤 남산 송신탑 헬기장으로 구조 헬기가 온다.\" 사고 전 응급실에서 일했던 도윤은, 여기 남은 사람들 중 다친 이가 나오면 자신이 감당해야 한다는 걸 안다. 그는 직접 확인하겠다며 자리에서 일어선다."
      },
      "choices": [
        {
          "label": "의무실에 들러 상비약을 챙긴다",
          "next": "scene13_shelter_meeting",
          "requires": null,
          "effects": {},
          "grantItem": "item_medkit",
          "grantSkill": null
        },
        {
          "label": "지체할 시간이 없다며 바로 나선다",
          "next": "scene13_shelter_meeting",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene13_shelter_meeting": {
      "image": "Scene13.png",
      "video": null,
      "text": "방송을 들은 은신처 사람들이 모닥불 주위로 모여든다. 나이 든 정비공 '오씨'는 \"예전에도 저런 방송 듣고 나갔다가 못 돌아온 사람들 있었다\"며 말리고, 젊은 쪽은 한 번 확인이라도 해보자고 도윤을 부추긴다. 도윤은 이들 앞에서 결정을 알려야 한다.",
      "choices": [
        {
          "label": "혼자 확인하고 오겠다고 사람들을 다독인다",
          "next": "scene14_supply_room",
          "requires": null,
          "effects": {
            "정신력": 5
          },
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "오씨의 경고를 무겁게 받아들이며 침묵한다",
          "next": "scene14_supply_room",
          "requires": null,
          "effects": {
            "정신력": -5
          },
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene14_supply_room": {
      "image": "Scene14.png.png",
      "video": null,
      "text": "의무실 겸 창고에서 도윤은 챙길 것을 고른다. 낡은 방독마스크 하나와 부서진 무전기 부품들이 구석에 쌓여 있다. 마스크는 하나뿐이라, 챙기려면 시간이 좀 더 걸린다.",
      "choices": [
        {
          "label": "필요한 것만 빠르게 챙긴다",
          "next": "scene15_exit_gate",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "시간을 들여 방독마스크까지 챙긴다",
          "next": "scene15_exit_gate",
          "requires": null,
          "effects": {},
          "grantItem": "item_gasmask",
          "grantSkill": null
        }
      ]
    },
    "scene15_exit_gate": {
      "image": "Scene15.png.png",
      "video": null,
      "text": "지상으로 이어지는 철제 해치 앞. 손잡이는 녹슬어 뻑뻑하다. 문을 열면 다시는 이 안온함으로 돌아오지 못할 수도 있다는 생각이 스친다. 도윤은 심호흡을 하고 해치를 밀어 올린다.",
      "choices": [
        {
          "label": "해치를 열고 지상으로 나선다",
          "next": "scene16_route_choice",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene16_route_choice": {
      "image": "Scene16.png",
      "video": null,
      "text": "지상은 여전히 잿가루로 뒤덮여 있다. 명동으로 가는 길은 두 갈래다 — 사람들이 다니던 넓은 대로, 그리고 청소부들의 눈을 피할 수 있는 좁은 골목 지하도. 대로는 빠르지만 눈에 잘 띄고, 골목은 안전하지만 시간이 더 걸린다.",
      "choices": [
        {
          "label": "명동 대로로 곧장 간다",
          "next": "scene02",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "인적 없는 골목 지하도로 돌아간다",
          "next": "scene18_alley_path",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene18_alley_path": {
      "image": "Scene18.png",
      "video": null,
      "text": "골목 지하도는 조용하지만 잿가루가 더 짙게 내려앉아 숨쉬기가 힘들다. 벽에는 낯선 낙서 — \"재건 연합, 한강 이남 통행 허가증 필요\" — 가 스프레이로 적혀 있다. 도윤은 처음 보는 문구에 잠시 멈춰 선다.",
      "choices": [
        {
          "label": "방독마스크를 쓰고 잿가루를 뚫고 지나간다",
          "next": "scene04",
          "requires": {
            "item": "item_gasmask"
          },
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "숨을 참고 그냥 지나간다",
          "next": "scene04",
          "requires": null,
          "effects": {
            "체력": -10
          },
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene02": {
      "image": "Scene2.png",
      "video": null,
      "text": "잿가루 날리는 명동 한복판, 무너진 쇼윈도 안에서 부스럭거리는 소리가 들린다. 다리를 다친 소년이 겁먹은 눈으로 도윤을 올려다본다. 멀리서 청소부들의 호루라기 소리가 가까워진다.",
      "choices": [
        {
          "label": "소년에게 다가가 상황을 살핀다",
          "next": "scene19_jun_plea",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene19_jun_plea": {
      "image": "Scene19.png",
      "video": null,
      "text": "소년은 이름이 '준'이라 했다. \"발목이 부러진 것 같아요... 청소부들이 절 찾고 있어요. 제발 데려가 주세요.\" 호루라기 소리가 점점 가까워진다. 데려가려면 다리를 살펴보고 업어야 하는데, 손이 비어 있어야 한다.",
      "choices": [
        {
          "label": "다리를 살피고 준을 업어 함께 이동한다",
          "next": "scene03",
          "requires": null,
          "effects": {},
          "grantItem": "item_family_photo",
          "grantSkill": null
        },
        {
          "label": "미안하지만 혼자 빠르게 남산으로 간다",
          "next": "scene04",
          "requires": null,
          "effects": {
            "정신력": -5
          },
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene03": {
      "image": "Scene3 (2).png",
      "video": null,
      "text": "준을 업고 명동성당으로 피신한다. 준은 아버지가 송신탑 엔지니어였고, 송신실 출입 코드를 자신만 안다고 털어놓는다. 새벽녘, 둘은 성당 뒷길로 남산에 오른다.",
      "choices": [
        {
          "label": "성당 뒷길로 남산에 오른다",
          "next": "scene05",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene04": {
      "image": "Scene4 (2).png",
      "video": null,
      "text": "지름길인 남산 1호터널은 칠흑같이 어둡고, 버려진 차들 사이로 잿빛인간 무리가 잠들어 있다.",
      "choices": [
        {
          "label": "지하 배관 지름길로 이동한다",
          "next": "scene05",
          "requires": {
            "skill": "skill_underground_sense"
          },
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "숨죽여 잿빛인간 사이를 지나간다",
          "next": "scene05",
          "requires": null,
          "effects": {},
          "grantItem": "item_radio",
          "grantSkill": null
        }
      ]
    },
    "scene05": {
      "image": "Scene5.png",
      "video": null,
      "text": "탑 주변은 청소부들의 바리케이드로 막혀 있다. 붙잡힌 도윤 앞에 마 반장이 나타나 말한다. \"헬기는 진짜다. 자리는 하나 남았고, 값은 네 은신처 위치다.\"",
      "choices": [
        {
          "label": "거래를 받아들인다",
          "next": "scene06",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "거래를 거절한다",
          "next": "scene10_rooftop_intel",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene06": {
      "image": "Scene6.png",
      "video": null,
      "text": "도윤이 을지로3가역을 불어버리고 헬기장에 오른다. 프로펠러 소리 너머 무전기에서 청소부 본대가 을지로로 출발했다는 교신이 들린다. 헬기가 뜨고, 발밑 서울이 잿빛으로 멀어진다.",
      "choices": []
    },
    "scene10_rooftop_intel": {
      "image": "Scene10.png",
      "video": null,
      "text": "거절당한 도윤이 창고로 끌려가기 전, 계단참 옥상 쪽 환풍구에 잠시 몸을 숨긴다. 발밑에서 청소부들의 무전이 들려온다 — \"재건 연합 쪽에서 반장님 몫을 늦게 준다는데요.\" \"한강 이남은 이미 그쪽이 다 먹었어. 여기서 자리 하나 더 만들어야 돼.\" 도윤은 처음으로 '안전지대'의 진짜 주인이 누구인지 짐작하게 된다.",
      "choices": [
        {
          "label": "숨을 죽이고 대화를 끝까지 엿듣는다",
          "next": "scene07",
          "requires": null,
          "effects": {
            "정신력": -5
          },
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "더 들키기 전에 자세를 낮춰 빠져나간다",
          "next": "scene07",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene07": {
      "image": "Scene7.png",
      "video": null,
      "text": "거절한 도윤은 창고에 갇히지만, 경비 교대 틈을 타 탈출해 탑 내부 계단으로 숨어든다. 위층에는 잠긴 송신실, 아래층에는 탈출용 비상구가 있다. 추격대의 발소리가 올라온다.",
      "choices": [
        {
          "label": "송신실로 올라가 방송한다",
          "next": "scene11_wide_transmission",
          "requires": {
            "item": "item_family_photo"
          },
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "무전기로 파악한 경로로 안전하게 탈출한다",
          "next": "scene12_underpass_allies",
          "requires": {
            "item": "item_radio"
          },
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "비상구로 급히 탈출한다",
          "next": "scene12_underpass_allies",
          "requires": null,
          "effects": {
            "체력": -10
          },
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene11_wide_transmission": {
      "image": "Scene11.png",
      "video": null,
      "text": "송신실 문을 열자 벽에 붙은 낡은 세계지도가 눈에 들어온다 — 서울뿐 아니라 도쿄, 상하이, 밴쿠버에도 같은 시각 회색 비가 관측됐다는 기록이 붉은 점으로 표시돼 있다. '회색 비'는 서울만의 재앙이 아니었다. 도윤은 이 사실을 방송에 실을지, 서울 구조에만 집중할지 결정해야 한다.",
      "choices": [
        {
          "label": "서울 좌표만 정확히 송출한다",
          "next": "scene08",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "관측 기록까지 함께 전 세계로 송출한다",
          "next": "scene08",
          "requires": null,
          "effects": {
            "정신력": -10
          },
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene08": {
      "image": "Scene8.png",
      "video": null,
      "text": "준의 코드로 송신실을 열고, 청소부의 미끼 방송을 끊은 뒤 서울 전역 은신처에 진짜 구조 좌표를 송출한다. 도윤은 탑에 고립되지만, 새벽 하늘로 여러 대의 헬기가 날아온다.",
      "choices": []
    },
    "scene12_underpass_allies": {
      "image": "Scene12.png",
      "video": null,
      "text": "비상구로 뛰어든 도윤은 지하 배수로에서 낯익은 얼굴들과 마주친다 — 청소부에게 쫓겨 숨어 지내던 다른 생존자들이다. 그들도 을지로 은신처 소문을 듣고 남산까지 흘러온 사람들이었다. 짧은 순간, 도윤은 이들과 함께 다음을 도모할 수 있을지 가늠한다.",
      "choices": [
        {
          "label": "생존자들에게 은신처 위치를 알려준다",
          "next": "scene09",
          "requires": null,
          "effects": {},
          "grantItem": null,
          "grantSkill": null
        },
        {
          "label": "정체를 밝히지 않고 조용히 지나간다",
          "next": "scene09",
          "requires": null,
          "effects": {
            "정신력": -5
          },
          "grantItem": null,
          "grantSkill": null
        }
      ]
    },
    "scene09": {
      "image": "Scene9.png",
      "video": null,
      "text": "헬기는 청소부들을 태우고 떠나고, 도윤은 빈손으로 을지로에 돌아온다. 하지만 은신처 위치는 지켜냈고, 사람들은 다음 기회를 기다리기로 한다.",
      "choices": []
    }
  },
  "endings": {
    "ending_a": {
      "sceneId": "scene06",
      "title": "혼자 남은 하늘",
      "image": null,
      "video": null
    },
    "ending_b": {
      "sceneId": "scene08",
      "title": "마지막 방송",
      "image": null,
      "video": null
    },
    "ending_c": {
      "sceneId": "scene09",
      "title": "지하로 돌아가다",
      "image": null,
      "video": null
    }
  }
};
