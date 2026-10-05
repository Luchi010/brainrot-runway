        const MOVE_SPEED_PX_PER_SEC = 90;
        const SPAWN_INTERVAL_MS = 2000;

        let defaultCharacterTypes = [
    {
        "name": "いやしんぼ",
        "cost": 1,
        "income": 1,
        "image": "file_00000000f28c820689e8a6b01ec34f2b.png",
        "weight": 50,
        "rarity": "レア"
    },
    {
        "name": "帰ってきた北島",
        "cost": 1000,
        "income": 25,
        "image": "file_00000000c8688206bb1da20fcca9bf5c.png",
        "weight": 15,
        "rarity": "レア"
    },
    {
        "name": "覚醒しんぼ",
        "cost": 3000,
        "income": 100,
        "image": "file_00000000236481f7858e7d807e4995ac.png",
        "weight": 10,
        "rarity": "エピック"
    },
    {
        "name": "まさかのオットセイ",
        "cost": 10000,
        "income": 500,
        "image": "file_000000003284820791b2b796518610e3.png",
        "weight": 7,
        "rarity": "エピック"
    },
    {
        "name": "チャリンぼう",
        "cost": 1000000,
        "income": 4300,
        "image": "1001001591.png",
        "weight": 1.1,
        "rarity": "レジェンド"
    },
    {
        "name": "落ットセイ",
        "cost": 950000,
        "income": 4000,
        "image": "1001001590.png",
        "weight": 1,
        "rarity": "シークレット"
    },
    {
        "name": "who",
        "cost": 5000000,
        "income": 8500,
        "image": "1001001623.png",
        "weight": 0.08,
        "rarity": "シークレット"
    }
];

        let defaultMutations = [
    {
        "name": "ノーマル",
        "chance": 65,
        "mult": 1,
        "color": "#ff9800",
        "cssClass": "mutation-normal"
    },
    {
        "name": "銀",
        "chance": 20,
        "mult": 1.1,
        "color": "#e0e0e0",
        "cssClass": "mutation-silver"
    },
    {
        "name": "金",
        "chance": 10,
        "mult": 1.2,
        "color": "#ffd700",
        "cssClass": "mutation-gold"
    },
    {
        "name": "ダイヤ",
        "chance": 4,
        "mult": 1.7,
        "color": "#00bcd4",
        "cssClass": "mutation-diamond"
    },
    {
        "name": "虹",
        "chance": 1,
        "mult": 1.5,
        "color": "linear-gradient(45deg, red, orange, yellow, green, blue, purple)",
        "cssClass": "mutation-rainbow"
    }
];

        // リボーン設定: rebirthConfigs[0] = 1回目のリボーンに必要な条件, [1] = 2回目...
        // requiredMoney: 必要な所持金 / requiredChars: [{name: キャラ名, qty: 必要所持数}, ...]（いくつでも追加可）
        let defaultRebirthConfigs = [
    {
        "requiredMoney": 100000,
        "requiredChars": [
            {
                "name": "いやしんぼ",
                "qty": 3
            }
        ]
    },
    {
        "requiredMoney": 500000,
        "requiredChars": [
            {
                "name": "覚醒しんぼ",
                "qty": 2
            },
            {
                "name": "まさかのオットセイ",
                "qty": 1
            }
        ]
    },
    {
        "requiredMoney": 1000000,
        "requiredChars": [
            {
                "name": "チャリンぼう",
                "qty": 2
            }
        ]
    },
    {
        "requiredMoney": 5000000,
        "requiredChars": [
            {
                "name": "落ットセイ",
                "qty": 2
            }
        ]
    },
    {
        "requiredMoney": 12000000,
        "requiredChars": [
            {
                "name": "who",
                "qty": 1
            }
        ]
    }
];

        const RARITY_OPTIONS = ["", "レア", "エピック", "レジェンド", "シークレット", "God"];
        const RARITY_COLORS = {
            "レア": "#4fc3f7",
            "エピック": "#ba68c8",
            "レジェンド": "#ffb300",
            "シークレット": "#ff5252",
            "God": "#ffffff"
        };
