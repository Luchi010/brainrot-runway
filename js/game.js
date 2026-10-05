let lastSpawnTime = performance.now();
        let lastIncomeTime = performance.now();
        const container = document.getElementById('game-container');
        const moneyElement = document.getElementById('money');
        let money = 1000;
        let currentUser = null;
        let forcedNextCharIndex = null;
        let forcedNextMutationIndex = null;

        

        let characterTypes = JSON.parse(JSON.stringify(defaultCharacterTypes));
        let mutations = JSON.parse(JSON.stringify(defaultMutations));
        let rebirthConfigs = JSON.parse(JSON.stringify(defaultRebirthConfigs));

        let rebirthCount = 0;
        const BASE_STOCK_SLOTS = 5;

        let stocks = [null, null, null, null, null];

        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        });

        // iPhoneのSafari(ホーム画面追加なしの通常ブラウザ)は要素のFullscreen APIに対応していないため、
        // 対応していない場合はCSSで画面全体を覆う「疑似フルスクリーン」に自動で切り替える。
        function supportsRealFullscreen() {
            const el = container;
            const hasRequest = !!(el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen);
            const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
            return hasRequest && enabled !== false;
        }

        function isInFullscreen() {
            return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || document.body.classList.contains('fake-fullscreen'));
        }

        function toggleFullscreen() {
            const el = container;

            if (!isInFullscreen()) {
                if (supportsRealFullscreen()) {
                    if (el.requestFullscreen) el.requestFullscreen().catch(() => enterFakeFullscreen());
                    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
                    else if (el.msRequestFullscreen) el.msRequestFullscreen();
                } else {
                    enterFakeFullscreen();
                }
            } else {
                if (document.body.classList.contains('fake-fullscreen')) {
                    exitFakeFullscreen();
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }

        function enterFakeFullscreen() {
            document.body.classList.add('fake-fullscreen');
            // アドレスバーを隠すための定番トリック（効果は端末やSafariのバージョンに依存）
            window.scrollTo(0, 1);
            setTimeout(() => window.scrollTo(0, 1), 300);
            updateFullscreenBtn();
        }

        function exitFakeFullscreen() {
            document.body.classList.remove('fake-fullscreen');
            updateFullscreenBtn();
        }

        function updateFullscreenBtn() {
            const btn = document.getElementById('fullscreen-btn');
            if (!btn) return;
            btn.innerText = isInFullscreen() ? '⛝' : '⛶';
        }

        document.addEventListener('fullscreenchange', updateFullscreenBtn);
        document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
        document.addEventListener('msfullscreenchange', updateFullscreenBtn);

        function formatMoney(amount) {
            if (amount >= 1e9) return (amount / 1e9).toFixed(1) + 'B';
            if (amount >= 1e6) return (amount / 1e6).toFixed(1) + 'M';
            if (amount >= 1e3) return (amount / 1e3).toFixed(1) + 'k';
            return Math.floor(amount).toString();
        }

        window.addEventListener('DOMContentLoaded', () => {
            const lastUser = localStorage.getItem('brainrot_last_user');
            if (lastUser) {
                const accounts = getStorageAccounts();
                if (accounts[lastUser]) {
                    loginUser(lastUser, accounts[lastUser]);
                }
            }
        });

        function getStorageAccounts() {
            try {
                return JSON.parse(localStorage.getItem('brainrot_accounts') || '{}');
            } catch(e) {
                return {};
            }
        }

        function saveStorageAccounts(accounts) {
            try {
                localStorage.setItem('brainrot_accounts', JSON.stringify(accounts));
            } catch (e) {
                showMsg("エラー: ブラウザの保存容量制限を超えました！");
                console.error(e);
            }
        }

        function handleAuth(type) {
            const userIn = document.getElementById('auth-username').value.trim();
            const passIn = document.getElementById('auth-password').value.trim();

            if (!userIn || !passIn) {
                showMsg("ユーザー名とパスワードを入力してください！");
                return;
            }

            const accounts = getStorageAccounts();

            if (type === 'register') {
                if (accounts[userIn]) {
                    showMsg("そのユーザー名は既に使用されています！");
                    return;
                }
                accounts[userIn] = {
                    password: passIn,
                    money: 1000,
                    stocks: [null, null, null, null, null],
                    rebirthCount: 0
                };
                saveStorageAccounts(accounts);
                showMsg("アカウントを作成しました！");
                loginUser(userIn, accounts[userIn]);

            } else if (type === 'login') {
                if (!accounts[userIn] || accounts[userIn].password !== passIn) {
                    showMsg("ユーザー名またはパスワードが違います");
                    return;
                }
                loginUser(userIn, accounts[userIn]);
            }
        }

        function sanitizeCharacterData(list) {
            return (list || JSON.parse(JSON.stringify(defaultCharacterTypes))).map(c => ({
                ...c,
                weight: c.weight !== undefined ? Math.max(0, parseFloat(c.weight) || 0) : 50,
                rarity: RARITY_OPTIONS.includes(c.rarity) ? c.rarity : ""
            }));
        }

        function sanitizeRebirthConfigs(list) {
            if (!Array.isArray(list)) return [];
            return list.map(level => ({
                requiredMoney: Math.max(0, parseInt(level.requiredMoney) || 0),
                requiredChars: Array.isArray(level.requiredChars) ? level.requiredChars.map(r => ({
                    name: r.name || "",
                    qty: Math.max(1, parseInt(r.qty) || 1)
                })) : []
            }));
        }

        function sanitizeMutationData(list) {
            return (list || JSON.parse(JSON.stringify(defaultMutations))).map((m, idx) => ({
                ...m,
                cssClass: m.cssClass || defaultMutations[idx]?.cssClass || "mutation-normal",
                chance: m.chance !== undefined ? Math.max(0, parseFloat(m.chance) || 0) : 10,
                mult: m.mult !== undefined ? parseFloat(m.mult) || 1.0 : 1.0
            }));
        }

        function loginUser(username, data) {
            currentUser = username;
            localStorage.setItem('brainrot_last_user', currentUser); World3D.setName(currentUser);

            money = data.money !== undefined ? data.money : 1000;
            rebirthCount = Math.max(0, parseInt(data.rebirthCount) || 0);
            stocks = data.stocks || [null, null, null, null, null];
            // キャラ名・画像・変異・リボーン設定はアカウントには保存しない。
            // 常にこのHTMLファイルに書き込まれている defaultCharacterTypes / defaultMutations / defaultRebirthConfigs
            // (＝最後に「HTMLコード生成」した時点の内容)を使う。
            characterTypes = JSON.parse(JSON.stringify(defaultCharacterTypes));
            mutations = JSON.parse(JSON.stringify(defaultMutations));
            rebirthConfigs = JSON.parse(JSON.stringify(defaultRebirthConfigs));

            const maxSlots = getMaxStockSlots();
            while (stocks.length < maxSlots) stocks.push(null);
            pruneStocksToExistingCharacters();

            document.getElementById('account-display').innerText = `👤 ${currentUser}`;
            document.getElementById('logout-btn').style.display = 'inline-block';
            document.getElementById('login-modal').style.display = 'none';

            moneyElement.innerText = formatMoney(money);
            updateStockUI();
            updateRebirthUI();
        }

        function logout() {
            saveUserData();
            currentUser = null;
            localStorage.removeItem('brainrot_last_user');

            World3D.clearRunners(); World3D.setName('ゲスト');
            rebirthCount = 0;
            stocks = [null, null, null, null, null];

            document.getElementById('account-display').innerText = 'ゲスト';
            document.getElementById('logout-btn').style.display = 'none';
            document.getElementById('login-modal').style.display = 'flex';
            document.getElementById('auth-username').value = '';
            document.getElementById('auth-password').value = '';
        }

        function saveUserData() {
            if (!currentUser) return;
            const accounts = getStorageAccounts();
            if (accounts[currentUser]) {
                accounts[currentUser].money = money;
                accounts[currentUser].stocks = stocks;
                accounts[currentUser].rebirthCount = rebirthCount;
                saveStorageAccounts(accounts);
            }
        }

        let confirmAction = null;
        function showConfirm(text, onYes, isHtml) {
            const textEl = document.getElementById('confirm-text');
            if (isHtml) {
                textEl.innerHTML = text;
            } else {
                textEl.innerText = text;
            }
            document.getElementById('confirm-modal').style.display = 'flex';
            confirmAction = onYes;
        }
        document.getElementById('confirm-yes-btn').onclick = () => {
            document.getElementById('confirm-modal').style.display = 'none';
            if (confirmAction) confirmAction();
        };
        document.getElementById('confirm-no-btn').onclick = () => {
            document.getElementById('confirm-modal').style.display = 'none';
        };

        function showMsg(text) {
            document.getElementById('msg-text').innerText = text;
            document.getElementById('msg-modal').style.display = 'flex';
        }
        function closeMsgModal() {
            document.getElementById('msg-modal').style.display = 'none';
        }

        // レアリティが「エピック」以上に設定されているキャラは、リボーン回数に応じて
        // 出現率(重み)が1.1倍ずつ(累積)上がっていく。例: 2回リボーン済みなら x1.21。
        // (レア以下のレアリティにはこのボーナスは適用されない)
        function getRareWeightMultiplier() {
            return Math.pow(1.1, rebirthCount);
        }

        function isEpicOrAbove(rarity) {
            const idx = RARITY_OPTIONS.indexOf(rarity);
            const epicIdx = RARITY_OPTIONS.indexOf("エピック");
            return idx >= epicIdx && epicIdx !== -1;
        }

        function getEffectiveWeight(char) {
            const base = Number(char.weight) || 0;
            if (isEpicOrAbove(char.rarity)) return base * getRareWeightMultiplier();
            return base;
        }

        // 現実時刻が「◯時ちょうど(0分)」の間は、エピック以上のレアリティが確定で出現する。
        function isEpicGuaranteedTime() {
            return new Date().getMinutes() === 0;
        }

        function getRandomCharacter() {
            if (characterTypes.length === 0) return null;

            if (isEpicGuaranteedTime()) {
                const epicPlusChars = characterTypes.filter(c => isEpicOrAbove(c.rarity) && getEffectiveWeight(c) > 0);
                if (epicPlusChars.length > 0) {
                    const totalEpicWeight = epicPlusChars.reduce((sum, c) => sum + getEffectiveWeight(c), 0);
                    let randEpic = Math.random() * totalEpicWeight;
                    for (let char of epicPlusChars) {
                        const w = getEffectiveWeight(char);
                        if (randEpic < w) return char;
                        randEpic -= w;
                    }
                    return epicPlusChars[0];
                }
            }

            const validChars = characterTypes.filter(c => getEffectiveWeight(c) > 0);
            if (validChars.length === 0) return characterTypes[0];

            const totalWeight = validChars.reduce((sum, c) => sum + getEffectiveWeight(c), 0);
            let rand = Math.random() * totalWeight;

            for (let char of validChars) {
                const w = getEffectiveWeight(char);
                if (rand < w) return char;
                rand -= w;
            }
            return validChars[0];
        }

        function getRandomMutation() {
            if (mutations.length === 0) return defaultMutations[0];
            const totalWeight = mutations.reduce((sum, m) => sum + (parseFloat(m.chance) || 0), 0);
            if (totalWeight <= 0) return mutations[0];

            let rand = Math.random() * totalWeight;
            for (let m of mutations) {
                const weight = parseFloat(m.chance) || 0;
                if (rand < weight) return m;
                rand -= weight;
            }
            return mutations[0];
        }

        function openPasswordModal() {
            document.getElementById('password-modal').style.display = 'flex';
            document.getElementById('password-input').value = '';
        }

        function checkPassword() {
            const pwd = document.getElementById('password-input').value;
            if (pwd === "0823") {
                document.getElementById('password-modal').style.display = 'none';
                openAdminPanel();
            } else {
                showMsg("パスワードが違います！");
            }
        }

        function closeModals() {
            document.getElementById('password-modal').style.display = 'none';
            document.getElementById('admin-modal').style.display = 'none';
            document.getElementById('export-modal').style.display = 'none';
        }

        function closeExportModal() {
            document.getElementById('export-modal').style.display = 'none';
            document.getElementById('admin-modal').style.display = 'flex';
        }

        function openAdminPanel() {
            document.getElementById('admin-money-input').value = money;
            renderAdminList();
            renderAdminMutations();
            renderAdminRebirths();
            renderAdminAccounts();
            renderForceControls();
            document.getElementById('admin-modal').style.display = 'flex';
        }

        function setMoneyFromAdmin() {
            const inputVal = parseInt(document.getElementById('admin-money-input').value);
            if (isNaN(inputVal) || inputVal < 0) {
                showMsg("正しい数字を入力してください！");
                return;
            }
            money = inputVal;
            moneyElement.innerText = formatMoney(money);
            saveUserData();
            showMsg(`所持金を ¥${formatMoney(money)} に変更しました！`);
        }

        function renderForceControls() {
            const charSelect = document.getElementById('force-char-select');
            charSelect.innerHTML = '<option value="">指定なし（確率に従う）</option>';
            characterTypes.forEach((char, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `[${idx + 1}] ${char.name}`;
                if (forcedNextCharIndex === idx) opt.selected = true;
                charSelect.appendChild(opt);
            });

            const mutSelect = document.getElementById('force-mutation-select');
            mutSelect.innerHTML = '<option value="">指定なし（ランダム）</option>';
            mutations.forEach((mut, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `${mut.name} (倍率:x${mut.mult})`;
                if (forcedNextMutationIndex === idx) opt.selected = true;
                mutSelect.appendChild(opt);
            });

            updateForceStatusText();
        }

        function setForceSpawn() {
            const cVal = document.getElementById('force-char-select').value;
            const mVal = document.getElementById('force-mutation-select').value;

            forcedNextCharIndex = cVal !== "" ? parseInt(cVal) : null;
            forcedNextMutationIndex = mVal !== "" ? parseInt(mVal) : null;

            updateForceStatusText();
            showMsg("次回出現の設定を保存しました！");
        }

        function clearForceSpawn() {
            forcedNextCharIndex = null;
            forcedNextMutationIndex = null;
            document.getElementById('force-char-select').value = "";
            document.getElementById('force-mutation-select').value = "";
            updateForceStatusText();
        }

        function updateForceStatusText() {
            const statusEl = document.getElementById('force-status-text');
            let cName = forcedNextCharIndex !== null && characterTypes[forcedNextCharIndex] ? characterTypes[forcedNextCharIndex].name : "確率に従う";
            let mName = forcedNextMutationIndex !== null && mutations[forcedNextMutationIndex] ? mutations[forcedNextMutationIndex].name : "ランダム";

            if (forcedNextCharIndex !== null || forcedNextMutationIndex !== null) {
                statusEl.innerText = `状態: 次回【${cName}】/ 変異【${mName}】で確定！`;
                statusEl.style.color = "#ffeb3b";
            } else {
                statusEl.innerText = "状態: 通常確率（自動設定）";
                statusEl.style.color = "#00e676";
            }
        }

        // ===== リボーン機能 =====
        function getMaxStockSlots() {
            return BASE_STOCK_SLOTS + rebirthCount;
        }

        function getNextRebirthConfig() {
            return rebirthConfigs[rebirthCount] || null;
        }

        // リボーンに必要な材料(キャラ)一覧を、画像付きのHTMLとして組み立てる。
        // rebirth-req-list(必要な材料メニュー)と、リボーン確認ダイアログの両方で使う。
        function buildRebirthRequirementsHtml(cfg) {
            const moneyOk = money >= (cfg.requiredMoney || 0);
            let html = `<div style="color:${moneyOk ? '#00e676' : '#f44336'};">💰 所持金: ${formatMoney(money)} / 必要:${formatMoney(cfg.requiredMoney || 0)}</div>`;
            (cfg.requiredChars || []).forEach(req => {
                const owned = countOwnedChar(req.name);
                const ok = owned >= req.qty;
                const reqChar = characterTypes.find(c => c.name === req.name);
                const imgSrc = reqChar && (reqChar.runtimeImage || reqChar.image);
                const imgHtml = imgSrc
                    ? `<div style="width:20px; height:20px; border-radius:50%; background-image:url('${imgSrc}'); background-size:cover; background-position:center; flex-shrink:0;"></div>`
                    : `<div style="width:20px; height:20px; border-radius:50%; background:#666; flex-shrink:0;"></div>`;
                html += `<div style="display:flex; align-items:center; gap:6px; color:${ok ? '#00e676' : '#f44336'};">${imgHtml}<span>👾 ${req.name}: ${owned} / ${req.qty}</span></div>`;
            });
            if ((cfg.requiredChars || []).length === 0) {
                html += `<div style="color:#888;">（キャラ条件なし）</div>`;
            }
            return html;
        }

        function countOwnedChar(name) {
            return stocks.filter(s => s && s.char && s.char.name === name).length;
        }

        // キャラ一覧(characterTypes)に存在しないキャラが手持ち(stocks)に残っている場合、
        // そのスロットを空にして手持ちからも削除する。
        function pruneStocksToExistingCharacters() {
            let changed = false;
            for (let i = 0; i < stocks.length; i++) {
                const slot = stocks[i];
                if (slot && slot.char) {
                    const stillExists = characterTypes.some(c => c.name === slot.char.name);
                    if (!stillExists) {
                        stocks[i] = null;
                        changed = true;
                    }
                }
            }
            if (changed) {
                updateStockUI();
                updateRebirthUI();
                saveUserData();
            }
            return changed;
        }

        function canRebirth() {
            const cfg = getNextRebirthConfig();
            if (!cfg) return false;
            if (money < (cfg.requiredMoney || 0)) return false;
            for (const req of (cfg.requiredChars || [])) {
                if (countOwnedChar(req.name) < req.qty) return false;
            }
            return true;
        }

        function openRebirthModal() {
            updateRebirthUI();
            document.getElementById('rebirth-modal').style.display = 'flex';
        }
        function closeRebirthModal() {
            document.getElementById('rebirth-modal').style.display = 'none';
        }

        function updateRebirthUI() {
            const btn = document.getElementById('rebirth-btn');
            if (btn) btn.innerText = `🔁 リボーン(${rebirthCount})`;

            const curEl = document.getElementById('rebirth-current');
            if (curEl) {
                curEl.innerHTML = `現在: リボーン ${rebirthCount}回 / 最大所持数 ${getMaxStockSlots()} / レア出現率 x${getRareWeightMultiplier().toFixed(2)}`;
            }

            const reqListEl = document.getElementById('rebirth-req-list');
            const doBtn = document.getElementById('rebirth-do-btn');
            if (!reqListEl || !doBtn) return;

            const cfg = getNextRebirthConfig();
            if (!cfg) {
                reqListEl.innerHTML = `<div style="color:#888;">次のリボーン条件はまだ運営パネルで設定されていません。</div>`;
                doBtn.disabled = true;
                doBtn.style.opacity = 0.5;
                doBtn.innerText = "設定なし";
                return;
            }

            reqListEl.innerHTML = buildRebirthRequirementsHtml(cfg);

            const ok = canRebirth();
            doBtn.disabled = !ok;
            doBtn.style.opacity = ok ? 1 : 0.5;
            doBtn.innerText = ok ? `${rebirthCount + 1}回目のリボーンをする` : "条件未達成";
        }

        function doRebirth() {
            const cfg = getNextRebirthConfig();
            if (!cfg) {
                showMsg("次のリボーン条件はまだ設定されていません");
                return;
            }
            if (!canRebirth()) {
                showMsg("リボーンの条件を満たしていません");
                return;
            }
            const confirmHtml = `
                <div style="margin-bottom:6px;">${rebirthCount + 1}回目のリボーンを行いますか？</div>
                <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:6px;">${buildRebirthRequirementsHtml(cfg)}</div>
                <div style="font-size:11px; color:#aaa;">（所持金・所持キャラはそのまま維持されます）<br>最大所持数+1 / レア出現率(エピック以上)x1.1</div>
            `;
            showConfirm(confirmHtml, () => {
                rebirthCount++;
                const maxSlots = getMaxStockSlots();
                while (stocks.length < maxSlots) stocks.push(null);
                updateStockUI();
                updateRebirthUI();
                saveUserData();
                closeRebirthModal();
                showMsg(`リボーン ${rebirthCount}回目 達成！\n最大所持数: ${maxSlots}\nレア出現率: x${getRareWeightMultiplier().toFixed(2)}`);
            }, true);
        }

        // ===== 運営パネル: リボーン設定編集 =====
        function renderAdminRebirths() {
            const listEl = document.getElementById('admin-rebirth-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            if (rebirthConfigs.length === 0) {
                listEl.innerHTML = `<div style="color:#888; font-size:10px; text-align:center;">リボーン段階が設定されていません</div>`;
                return;
            }

            rebirthConfigs.forEach((level, levelIdx) => {
                const item = document.createElement('div');
                item.classList.add('admin-char-item');

                let charsHtml = (level.requiredChars || []).map((req, reqIdx) => {
                    const options = characterTypes.map(c => `<option value="${c.name}" ${c.name === req.name ? 'selected' : ''}>${c.name}</option>`).join('');
                    return `
                        <div class="admin-row" style="margin-left:6px;">
                            <select class="admin-select" style="flex:1;" onchange="syncRebirthReqChar(${levelIdx}, ${reqIdx}, this.value, null)">
                                <option value="">-- キャラを選択 --</option>
                                ${options}
                            </select>
                            <span style="font-size:10px;">必要数:</span>
                            <input type="number" min="1" value="${req.qty}" style="width:50px;" oninput="syncRebirthReqChar(${levelIdx}, ${reqIdx}, null, this.value)">
                            <button class="admin-btn admin-btn-danger" style="padding:3px 6px; font-size:10px;" onclick="removeRebirthReqChar(${levelIdx}, ${reqIdx})">×</button>
                        </div>`;
                }).join('');

                item.innerHTML = `
                    <div class="admin-row" style="justify-content:space-between;">
                        <span style="color:#e040fb; font-weight:bold;">リボーン ${levelIdx + 1}回目の条件</span>
                        <button class="admin-btn admin-btn-danger" style="padding:3px 8px;" onclick="deleteRebirthLevel(${levelIdx})">段階削除</button>
                    </div>
                    <div class="admin-row">
                        <span style="width:60px;">必要金額:</span> <input type="number" min="0" value="${level.requiredMoney}" style="flex:1;" oninput="syncRebirthMoney(${levelIdx}, this.value)">
                    </div>
                    <div style="font-size:10px; color:#aaa; margin-left:6px;">必要キャラ（いくつでも追加可）:</div>
                    ${charsHtml || '<div style="font-size:10px; color:#888; margin-left:6px;">未設定</div>'}
                    <div class="admin-row">
                        <button class="admin-btn" style="background:#03a9f4; flex:1;" onclick="addRebirthReqChar(${levelIdx})">＋ 必要キャラを追加</button>
                    </div>
                `;
                listEl.appendChild(item);
            });
        }

        function addRebirthLevel() {
            rebirthConfigs.push({ requiredMoney: 0, requiredChars: [] });
            renderAdminRebirths();
            saveUserData();
        }

        function deleteRebirthLevel(levelIdx) {
            showConfirm(`リボーン${levelIdx + 1}回目の条件を削除しますか？`, () => {
                rebirthConfigs.splice(levelIdx, 1);
                renderAdminRebirths();
                saveUserData();
            });
        }

        function syncRebirthMoney(levelIdx, value) {
            if (!rebirthConfigs[levelIdx]) return;
            rebirthConfigs[levelIdx].requiredMoney = Math.max(0, parseInt(value) || 0);
            saveUserData();
        }

        function addRebirthReqChar(levelIdx) {
            if (!rebirthConfigs[levelIdx]) return;
            if (!rebirthConfigs[levelIdx].requiredChars) rebirthConfigs[levelIdx].requiredChars = [];
            const firstName = characterTypes[0] ? characterTypes[0].name : "";
            rebirthConfigs[levelIdx].requiredChars.push({ name: firstName, qty: 1 });
            renderAdminRebirths();
            saveUserData();
        }

        function removeRebirthReqChar(levelIdx, reqIdx) {
            if (!rebirthConfigs[levelIdx]) return;
            rebirthConfigs[levelIdx].requiredChars.splice(reqIdx, 1);
            renderAdminRebirths();
            saveUserData();
        }

        function syncRebirthReqChar(levelIdx, reqIdx, nameVal, qtyVal) {
            const req = rebirthConfigs[levelIdx] && rebirthConfigs[levelIdx].requiredChars[reqIdx];
            if (!req) return;
            if (nameVal !== null) req.name = nameVal;
            if (qtyVal !== null) req.qty = Math.max(1, parseInt(qtyVal) || 1);
            saveUserData();
        }

        function renderAdminAccounts() {
            const accListEl = document.getElementById('admin-account-list');
            const accCountLabel = document.getElementById('acc-count-label');
            const accounts = getStorageAccounts();
            const keys = Object.keys(accounts);

            accCountLabel.innerText = keys.length;
            accListEl.innerHTML = '';

            if (keys.length === 0) {
                accListEl.innerHTML = `<div style="color:#888; font-size:10px; text-align:center;">登録アカウントなし</div>`;
                return;
            }

            keys.forEach(uname => {
                const item = document.createElement('div');
                item.classList.add('admin-acc-item');
                item.innerHTML = `
                    <div style="flex:1; min-width:0;">👤 <strong>${uname}</strong> <span style="color:#00e676; font-size:10px;">(¥${formatMoney(accounts[uname].money || 0)})</span></div>
                    <button class="admin-btn admin-btn-danger" style="padding:4px 8px; font-size:10px;" onclick="deleteAccountFromAdmin('${uname}')">削除</button>
                `;
                accListEl.appendChild(item);
            });
        }

        function deleteAccountFromAdmin(targetUser) {
            showConfirm(`アカウント「${targetUser}」を削除しますか？`, () => {
                const accounts = getStorageAccounts();
                delete accounts[targetUser];
                saveStorageAccounts(accounts);

                if (currentUser === targetUser) {
                    logout();
                } else {
                    renderAdminAccounts();
                }
                showMsg(`「${targetUser}」を削除しました`);
            });
        }

        // 重みがごく小さい値(例:0.0000001)でも「0.0%」に潰れず見えるように、
        // 必要に応じて小数点以下の桁数を増やして表示するヘルパー。
        function formatPct(pct) {
            if (!(pct > 0)) return '0.0';
            if (pct >= 0.1) return pct.toFixed(1);
            // ごく小さい値は有効数字が見えるまで桁数を増やす
            for (let digits = 2; digits <= 12; digits++) {
                const s = pct.toFixed(digits);
                if (parseFloat(s) > 0) return s;
            }
            return pct.toExponential(2);
        }

        function updatePercentageLabels() {
            const totalWeight = characterTypes.reduce((sum, c) => sum + (Math.max(0, parseFloat(c.weight)) || 0), 0);
            characterTypes.forEach((char, index) => {
                const pctSpan = document.getElementById(`admin-pct-${index}`);
                if (pctSpan) {
                    const curWeight = Math.max(0, parseFloat(char.weight)) || 0;
                    const pct = totalWeight > 0 ? formatPct((curWeight / totalWeight) * 100) : '0.0';
                    pctSpan.innerText = `(${pct}%)`;
                }
            });
        }

        function updateMutationPercentageLabels() {
            const totalWeight = mutations.reduce((sum, m) => sum + (Math.max(0, parseFloat(m.chance)) || 0), 0);
            mutations.forEach((mut, index) => {
                const pctSpan = document.getElementById(`admin-mut-pct-${index}`);
                if (pctSpan) {
                    const curChance = Math.max(0, parseFloat(mut.chance)) || 0;
                    const pct = totalWeight > 0 ? ((curChance / totalWeight) * 100).toFixed(1) : '0.0';
                    pctSpan.innerText = `(${pct}%)`;
                }
            });
        }

        // 画像アップロード: Base64は使わず、ファイル名だけの軽量なパス参照を保存する。
        // 実行中のプレビュー表示だけ一時的な blob URL (runtimeImage) を使い、
        // HTMLコード生成時には必ず runtimeImage を除去してファイル名だけを書き出す（下の generateHtmlCode 参照）。
        // 画像は HTML ファイルと「同じフォルダ」に置く前提（サブフォルダ不要）。
        function handleImageUpload(event, index) {
            const file = event.target.files[0];
            if (!file) return;

            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const imagePath = safeName;
            const imageInput = document.getElementById(`admin-image-${index}`);
            if (imageInput) {
                imageInput.value = imagePath;
                syncCharData(index);
            }

            characterTypes[index].runtimeImage = URL.createObjectURL(file);
            renderAdminList();
            saveUserData();
            showMsg(`プレビュー用に画像をセットしました。\n保存されるファイル名: ${imagePath}\n\n書き出したHTMLで実際に表示するには、HTMLファイルと「同じフォルダ」に「${safeName}」という同じファイル名で画像を置いてください（サブフォルダは不要です）。`);
        }

        function renderAdminList() {
            const listContainer = document.getElementById('admin-character-list');
            listContainer.innerHTML = '';

            const totalWeight = characterTypes.reduce((sum, c) => sum + (Math.max(0, parseFloat(c.weight)) || 0), 0);

            characterTypes.forEach((char, index) => {
                const curWeight = char.weight !== undefined ? char.weight : 50;
                const pct = totalWeight > 0 ? formatPct((Math.max(0, parseFloat(curWeight)) / totalWeight) * 100) : '0.0';

                const item = document.createElement('div');
                item.classList.add('admin-char-item');
                item.innerHTML = `
                    <div class="admin-row">
                        <span style="width:35px;">名前:</span> <input type="text" value="${char.name}" id="admin-name-${index}" oninput="syncCharData(${index})" style="flex:1; min-width:90px;">
                        <span style="width:45px;">コスト:</span> <input type="number" value="${char.cost}" id="admin-cost-${index}" oninput="syncCharData(${index})" style="width:60px;">
                    </div>
                    <div class="admin-row">
                        <span style="width:35px;">稼ぎ:</span> <input type="number" value="${char.income}" id="admin-income-${index}" oninput="syncCharData(${index})" style="width:60px;">
                        <span style="width:55px;">重み(比率):</span> <input type="number" value="${curWeight}" id="admin-weight-${index}" oninput="syncCharData(${index})" style="width:70px;" min="0" step="any" placeholder="例:0.0000001">
                        <span style="font-size:10px; color:#00e676; font-weight:bold;" id="admin-pct-${index}">(${pct}%)</span>
                    </div>
                    <div class="admin-row">
                        <span style="width:35px;">画像:</span> <input type="text" value="${char.image || ''}" id="admin-image-${index}" oninput="syncCharData(${index})" style="flex:1; min-width:90px;" placeholder="chara.png">
                        <input type="file" accept="image/*" style="font-size:10px; width:95px;" onchange="handleImageUpload(event, ${index})">
                    </div>
                    <div class="admin-row">
                        <span style="width:55px;">レア度:</span>
                        <select class="admin-select" id="admin-rarity-${index}" onchange="syncCharData(${index})" style="flex:1;">
                            ${RARITY_OPTIONS.map(r => `<option value="${r}" ${(char.rarity || "") === r ? 'selected' : ''}>${r === "" ? "なし" : r}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-row" style="justify-content:flex-end; margin-top:2px;">
                        <button class="admin-btn admin-btn-danger" style="padding:3px 8px;" onclick="deleteCharacter(${index})">削除</button>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }

        function renderAdminMutations() {
            const listContainer = document.getElementById('admin-mutation-list');
            listContainer.innerHTML = '';

            const totalWeight = mutations.reduce((sum, m) => sum + (Math.max(0, parseFloat(m.chance)) || 0), 0);

            mutations.forEach((mut, index) => {
                const curChance = mut.chance !== undefined ? mut.chance : 10;
                const pct = totalWeight > 0 ? ((Math.max(0, parseFloat(curChance)) / totalWeight) * 100).toFixed(1) : '0.0';

                const item = document.createElement('div');
                item.classList.add('admin-mut-item');
                item.innerHTML = `
                    <div class="admin-row">
                        <span style="width:35px;">変異名:</span> <input type="text" value="${mut.name}" id="admin-mut-name-${index}" oninput="syncMutationData(${index})" style="flex:1; min-width:80px;">
                        <span style="width:35px;">倍率:</span> <input type="number" step="0.1" value="${mut.mult}" id="admin-mut-mult-${index}" oninput="syncMutationData(${index})" style="width:50px;">
                    </div>
                    <div class="admin-row">
                        <span style="width:55px;">確率値:</span> <input type="number" step="0.1" value="${curChance}" id="admin-mut-chance-${index}" oninput="syncMutationData(${index})" style="width:60px;" min="0">
                        <span style="font-size:10px; color:#00e676; font-weight:bold;" id="admin-mut-pct-${index}">(${pct}%)</span>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }

        function syncCharData(index) {
            const nameEl = document.getElementById(`admin-name-${index}`);
            const costEl = document.getElementById(`admin-cost-${index}`);
            const incomeEl = document.getElementById(`admin-income-${index}`);
            const weightEl = document.getElementById(`admin-weight-${index}`);
            const imageEl = document.getElementById(`admin-image-${index}`);
            const rarityEl = document.getElementById(`admin-rarity-${index}`);

            if(nameEl && characterTypes[index]) characterTypes[index].name = nameEl.value;
            if(costEl && characterTypes[index]) characterTypes[index].cost = parseInt(costEl.value) || 0;
            if(incomeEl && characterTypes[index]) characterTypes[index].income = parseInt(incomeEl.value) || 0;
            if(weightEl && characterTypes[index]) characterTypes[index].weight = Math.max(0, parseFloat(weightEl.value) || 0);
            if(imageEl && characterTypes[index]) {
                characterTypes[index].image = imageEl.value;
                delete characterTypes[index].runtimeImage;
            }
            if(rarityEl && characterTypes[index]) characterTypes[index].rarity = rarityEl.value;

            updatePercentageLabels();
            saveUserData();
            renderForceControls();
        }

        function syncMutationData(index) {
            const nameEl = document.getElementById(`admin-mut-name-${index}`);
            const multEl = document.getElementById(`admin-mut-mult-${index}`);
            const chanceEl = document.getElementById(`admin-mut-chance-${index}`);

            if(nameEl && mutations[index]) mutations[index].name = nameEl.value;
            if(multEl && mutations[index]) mutations[index].mult = parseFloat(multEl.value) || 1.0;
            if(chanceEl && mutations[index]) mutations[index].chance = Math.max(0, parseFloat(chanceEl.value) || 0);

            updateMutationPercentageLabels();
            saveUserData();
            renderForceControls();
        }

        function deleteCharacter(index) {
            if (characterTypes.length <= 1) {
                showMsg("最低1体は必要です！");
                return;
            }
            characterTypes.splice(index, 1);
            if (forcedNextCharIndex === index) forcedNextCharIndex = null;
            pruneStocksToExistingCharacters();
            renderAdminList();
            renderForceControls();
            saveUserData();
        }

        function addCharacterPrompt() {
            characterTypes.push({ name: "新しいキャラ", cost: 1000, income: 100, image: "new.png", weight: 10, rarity: "" });
            renderAdminList();
            renderForceControls();
            saveUserData();
        }

        function resetToHtmlDefaults() {
            showConfirm("キャラクター・変異・リボーン設定を、HTMLファイル内の初期データにリセット・同期しますか？", () => {
                characterTypes = JSON.parse(JSON.stringify(defaultCharacterTypes));
                mutations = JSON.parse(JSON.stringify(defaultMutations));
                rebirthConfigs = JSON.parse(JSON.stringify(defaultRebirthConfigs));
                pruneStocksToExistingCharacters();
                renderAdminList();
                renderAdminMutations();
                renderAdminRebirths();
                renderForceControls();
                saveUserData();
                showMsg("HTML初期設定に同期しました！");
            });
        }

        // 生成されるHTMLコードには画像データ(Base64)は一切含まれない。
        // characterTypes から runtimeImage (一時的な blob URL) を必ず除去し、
        // ファイル名だけの文字列を defaultCharacterTypes として書き出す。
        // そのため画像を何枚使ってもコード自体は軽量なまま。
        function generateHtmlCode() {
            characterTypes.forEach((_, idx) => syncCharData(idx));
            mutations.forEach((_, idx) => syncMutationData(idx));

            const cleanCharacterTypes = characterTypes.map(({ runtimeImage, ...rest }) => rest);

            const clone = document.documentElement.cloneNode(true);
            
            
            
            ['login-modal', 'admin-modal', 'password-modal', 'export-modal', 'confirm-modal', 'msg-modal'].forEach(id => {
                const modalEl = clone.querySelector('#' + id);
                if (modalEl) {
                    modalEl.style.display = (id === 'login-modal') ? 'flex' : 'none';
                }
            });

            const stockContainer = clone.querySelector('#stock-container');
            if (stockContainer) stockContainer.innerHTML = '';

            const adminCharList = clone.querySelector('#admin-character-list');
            if (adminCharList) adminCharList.innerHTML = '';

            const adminMutList = clone.querySelector('#admin-mutation-list');
            if (adminMutList) adminMutList.innerHTML = '';

            const adminRebirthList = clone.querySelector('#admin-rebirth-list');
            if (adminRebirthList) adminRebirthList.innerHTML = '';

            const rebirthBtn = clone.querySelector('#rebirth-btn');
            if (rebirthBtn) rebirthBtn.innerText = '🔁 リボーン(0)';

            const rebirthModal = clone.querySelector('#rebirth-modal');
            if (rebirthModal) rebirthModal.style.display = 'none';

            const adminAccList = clone.querySelector('#admin-account-list');
            if (adminAccList) adminAccList.innerHTML = '<div style="color:#888; font-size:10px; text-align:center;">登録アカウントなし</div>';

            const accCountLabel = clone.querySelector('#acc-count-label');
            if (accCountLabel) accCountLabel.innerText = '0';

            const forceCharSelect = clone.querySelector('#force-char-select');
            if (forceCharSelect) forceCharSelect.innerHTML = '<option value="">指定なし（確率に従う）</option>';

            const forceMutSelect = clone.querySelector('#force-mutation-select');
            if (forceMutSelect) forceMutSelect.innerHTML = '<option value="">指定なし（ランダム）</option>';

            const forceStatusText = clone.querySelector('#force-status-text');
            if (forceStatusText) {
                forceStatusText.innerText = "状態: 通常確率（自動設定）";
                forceStatusText.style.color = "#00e676";
            }

            const adminMoneyInput = clone.querySelector('#admin-money-input');
            if (adminMoneyInput) adminMoneyInput.value = '1000';

            const authUser = clone.querySelector('#auth-username');
            if (authUser) authUser.value = '';
            const authPass = clone.querySelector('#auth-password');
            if (authPass) authPass.value = '';

            let fullHtml = '<!DOCTYPE html>\n<html lang="ja">\n' + clone.innerHTML.trim() + '\n</html>';

            const usedImagePaths = [...new Set(cleanCharacterTypes.map(c => c.image).filter(Boolean))];
            const imageNote = '<!--\n' +
                '  ★このHTMLファイルには画像データは含まれていません（軽量版）。\n' +
                '  以下のファイル名を、このHTMLファイルと「同じフォルダ」に\n' +
                '  同じ名前で置いてください（サブフォルダは不要）。画像が無いキャラは色付きの丸で表示されます。\n' +
                (usedImagePaths.length > 0
                    ? usedImagePaths.map(p => '    - ' + p).join('\n') + '\n'
                    : '    (現在、画像パスが設定されたキャラはありません)\n') +
                '-->\n';

            const updatedCharScript = 'let defaultCharacterTypes = ' + JSON.stringify(cleanCharacterTypes, null, 4) + ';';
            const updatedMutScript = 'let defaultMutations = ' + JSON.stringify(mutations, null, 4) + ';';
            const updatedRebirthScript = 'let defaultRebirthConfigs = ' + JSON.stringify(rebirthConfigs, null, 4) + ';';

            fullHtml = fullHtml.replace(/let defaultCharacterTypes\s*=\s*\[[\s\S]*?\];/, updatedCharScript);
            fullHtml = fullHtml.replace(/let defaultMutations\s*=\s*\[[\s\S]*?\];/, updatedMutScript);
            fullHtml = fullHtml.replace(/let defaultRebirthConfigs\s*=\s*\[[\s\S]*?\];/, updatedRebirthScript);

            fullHtml = imageNote + fullHtml;

            document.getElementById('admin-modal').style.display = 'none';
            document.getElementById('export-modal').style.display = 'flex';
            document.getElementById('export-textarea').value = updatedCharScript + '\n\n' + updatedMutScript + '\n\n' + updatedRebirthScript + '\n';
        }

        function copyExportCode() {
            const textarea = document.getElementById('export-textarea');
            textarea.select();
            document.execCommand('copy');
            showMsg("HTMLコードをコピーしました！\n(画像データは含まれていません。画像はHTMLと同じフォルダに置いてください)");
        }

        function downloadTxtFile() {
            const textarea = document.getElementById('export-textarea');
            const code = textarea.value;
            const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'brainrot_runway.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showMsg("txtファイルとしてダウンロードしました！");
        }

        function updateStockUI() {
            const stockContainer = document.getElementById('stock-container');
            stockContainer.innerHTML = '';

            for (let i = 0; i < stocks.length; i++) {
                const slotDiv = document.createElement('div');
                slotDiv.classList.add('slot');

                if (stocks[i]) {
                    slotDiv.classList.add('filled');
                    const char = stocks[i].char;
                    const mut = stocks[i].mutation;
                    const accumulated = stocks[i].accumulated;
                    const actualCost = Math.floor(char.cost * mut.mult);
                    const refund = Math.floor(actualCost * 0.5);

                    // 所持キャラの表示にはレアリティは出さず、変異と名前だけを表示する。
                    let displayName = mut.name !== "ノーマル" ? `[${mut.name}]${char.name}` : `${char.name}`;
                    let imgSrc = char.runtimeImage || char.image;
                    let imgClass = imgSrc ? `has-image ${mut.cssClass || 'mutation-normal'}` : `no-image ${mut.cssClass || 'mutation-normal'}`;
                    let bgStyle = imgSrc ? `background-image: url('${imgSrc}');` : `background: ${mut.color || '#fff'};`;

                    slotDiv.innerHTML = `
                        <div style="color:#ffeb3b; overflow:hidden; white-space:nowrap; font-size:7px;">${displayName}</div>
                        <div class="slot-img ${imgClass}" style="${bgStyle}"></div>
                        <div class="slot-stats">
                            <div>+${Math.floor(char.income * mut.mult)}/s</div>
                            <div class="collect-amount">回収: ${formatMoney(accumulated)}</div>
                        </div>
                        <div style="font-size:7px; color:#aaa;">長押し:売却</div>
                    `;

                    let holdTimer = null;
                    let isHolding = false;
                    let touchStartTime = 0;

                    const startHold = (e) => {
                        e.preventDefault();
                        isHolding = true;
                        touchStartTime = Date.now();
                        slotDiv.style.border = "2px solid #f44336";

                        holdTimer = setTimeout(() => {
                            isHolding = false;
                            showConfirm(`このキャラクターを売却しますか？\n売却額: ¥${formatMoney(refund)}`, () => {
                                money += refund;
                                moneyElement.innerText = formatMoney(money);
                                stocks[i] = null;
                                updateStockUI();
                                updateRebirthUI();
                                saveUserData();
                            });
                            slotDiv.style.border = "2px solid #00e676";
                        }, 1000);
                    };

                    const cancelHold = () => {
                        if (!isHolding) return;
                        isHolding = false;
                        slotDiv.style.border = "2px solid #00e676";
                        if (holdTimer) clearTimeout(holdTimer);
                    };

                    slotDiv.addEventListener('pointerdown', startHold);
                    slotDiv.addEventListener('pointerup', (e) => {
                        const duration = Date.now() - touchStartTime;
                        cancelHold();
                        if (duration < 1000 && !isHolding) {
                            if (stocks[i] && stocks[i].accumulated > 0) {
                                money += stocks[i].accumulated;
                                moneyElement.innerText = formatMoney(money);
                                stocks[i].accumulated = 0;
                                updateStockUI();
                                saveUserData();
                            }
                        }
                    });
                    slotDiv.addEventListener('pointerleave', cancelHold);

                } else {
                    slotDiv.innerHTML = `<span style="color:#777; font-size:10px; margin-top:45px;">EMPTY</span>`;
                }
                stockContainer.appendChild(slotDiv);
            }
        }

        function spawnCharacter(spawnTime) {
            if (characterTypes.length === 0 || !currentUser) return;

            let charType;
            if (forcedNextCharIndex !== null && characterTypes[forcedNextCharIndex]) {
                charType = characterTypes[forcedNextCharIndex];
                forcedNextCharIndex = null;
            } else {
                charType = getRandomCharacter();
            }

            let mutation;
            if (forcedNextMutationIndex !== null && mutations[forcedNextMutationIndex]) {
                mutation = mutations[forcedNextMutationIndex];
                forcedNextMutationIndex = null;
            } else {
                mutation = getRandomMutation();
            }
            updateForceStatusText();

            const finalCost = Math.floor(charType.cost * mutation.mult);
            const finalIncome = Math.floor(charType.income * mutation.mult);
            const rarityPrefix = charType.rarity ? `《${charType.rarity}》` : '';
            const label = mutation.name !== "ノーマル" ? `[${mutation.name}] ${rarityPrefix}${charType.name}` : `${rarityPrefix}${charType.name}`;

            const ent = World3D.addRunner({
                spawnTime: spawnTime,
                imgSrc: charType.runtimeImage || charType.image,
                color: mutation.color || '#fff',
                rainbow: /rainbow/.test(mutation.cssClass || ''),
                name: label,
                rarityColor: RARITY_COLORS[charType.rarity] || '#fff',
                sub: `買:¥${formatMoney(finalCost)} / 稼:+${finalIncome}/s`
            });

            let holdTimer = null;
            let isHolding = false;

            // 3D空間のキャラを1秒長押しで購入
            ent.onDown = () => {
                if (isHolding) return;
                if (money < finalCost) { showMsg("お金が足りない！"); return; }
                const emptyIndex = stocks.findIndex(s => s === null);
                if (emptyIndex === -1) { showMsg("ストックが満杯です！"); return; }

                isHolding = true;
                ent.setHolding(true);
                holdTimer = setTimeout(() => {
                    isHolding = false;
                    money -= finalCost;
                    moneyElement.innerText = formatMoney(money);
                    stocks[emptyIndex] = { char: charType, mutation: mutation, accumulated: 0 };
                    updateStockUI();
                    updateRebirthUI();
                    saveUserData();
                    ent.remove();
                }, 1000);
            };
            ent.onUp = () => {
                if (!isHolding) return;
                isHolding = false;
                ent.setHolding(false);
                if (holdTimer) clearTimeout(holdTimer);
            };
        }

        function gameLoop(now) {
            if (now - lastSpawnTime >= SPAWN_INTERVAL_MS) {
                if (currentUser) spawnCharacter(now);
                lastSpawnTime = now;
            }
            World3D.update(now);

            if (now - lastIncomeTime >= 1000) {
                const elapsedSec = (now - lastIncomeTime) / 1000;
                const stockContainerEl = document.getElementById('stock-container');
                
                stocks.forEach((slot, i) => {
                    if (slot) {
                        slot.accumulated += (slot.char.income * slot.mutation.mult) * elapsedSec;
                        const slotEl = stockContainerEl.children[i];
                        if (slotEl) {
                            const collectEl = slotEl.querySelector('.collect-amount');
                            if (collectEl) {
                                collectEl.innerText = `回収: ${formatMoney(slot.accumulated)}`;
                            }
                        }
                    }
                });
                lastIncomeTime = now;
            }

            requestAnimationFrame(gameLoop);
        }

        requestAnimationFrame(gameLoop);

        // 下部ストックメニューを、上部をドラッグして下にスワイプすると縮小化できるようにする
        (function setupStockPanelDrag() {
            const panel = document.getElementById('bottom-panel');
            const handle = document.getElementById('panel-handle');
            if (!panel || !handle) return;

            let dragStartY = 0;
            let dragging = false;
            let didToggle = false;
            const COLLAPSE_THRESHOLD = 40;
            const TAP_THRESHOLD = 8;

            const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

            const onDragStart = (e) => {
                dragging = true;
                didToggle = false;
                dragStartY = getY(e);
            };

            const onDragMove = (e) => {
                if (!dragging) return;
                const deltaY = getY(e) - dragStartY;
                if (deltaY > COLLAPSE_THRESHOLD && !panel.classList.contains('collapsed')) {
                    panel.classList.add('collapsed');
                    didToggle = true;
                    dragging = false;
                } else if (deltaY < -COLLAPSE_THRESHOLD && panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    didToggle = true;
                    dragging = false;
                }
            };

            const onDragEnd = (e) => {
                if (dragging && !didToggle) {
                    // 小さな動き(タップ)だけなら開閉をトグル
                    const deltaY = Math.abs((e.changedTouches ? e.changedTouches[0].clientY : e.clientY) - dragStartY);
                    if (deltaY < TAP_THRESHOLD) {
                        panel.classList.toggle('collapsed');
                    }
                }
                dragging = false;
            };

            handle.addEventListener('pointerdown', onDragStart);
            window.addEventListener('pointermove', onDragMove);
            window.addEventListener('pointerup', onDragEnd);
            window.addEventListener('pointercancel', () => { dragging = false; });
        })();

        { const _u = updateStockUI; updateStockUI = function () { _u(); World3D.setStocks(stocks); }; }
