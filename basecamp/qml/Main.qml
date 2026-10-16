import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import QtQuick.LocalStorage 2.15
import "wiki.js" as Wiki

Item {
    id: root

    property var wiki: Wiki.createWiki("")
    property string adminKey: ""
    property string snapshotCid: ""
    property string currentTitle: Wiki.MAIN_PAGE
    property string mode: "article"
    property string notice: ""
    property string busyText: ""
    property string deliveryStatus: "off"
    property string storageStatus: "off"
    property string userName: ""
    property string userKey: ""
    property string seedHex: ""
    property var envelopes: []
    property var article: ({ html: "", title: Wiki.MAIN_PAGE, missing: true, categories: [], headings: [] })
    property var dlChunks: ({})
    readonly property bool hasLogos: typeof logos !== "undefined" && logos && logos.callModuleAsync
    readonly property color ink: "#202122"
    readonly property color muted: "#54595d"
    readonly property color link: "#3366cc"
    readonly property color line: "#a2a9b1"
    readonly property color paper: "#ffffff"
    readonly property color wash: "#f8f9fa"
    readonly property color header: "#eaecf0"

    function db() {
        return LocalStorage.openDatabaseSync("logos-wiki", "1.0", "Logos Wiki cache", 10 * 1024 * 1024)
    }

    function kvGet(key, fallback) {
        var value = fallback
        try {
            db().transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)")
                var rows = tx.executeSql("SELECT v FROM kv WHERE k = ?", [key])
                if (rows.rows.length) value = rows.rows.item(0).v
            })
        } catch (e) {}
        return value
    }

    function kvSet(key, value) {
        try {
            db().transaction(function (tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)")
                tx.executeSql("INSERT OR REPLACE INTO kv VALUES (?, ?)", [key, value])
            })
        } catch (e) {}
    }

    function resetWiki() {
        wiki = Wiki.createWiki(adminKey)
        for (var i = 0; i < envelopes.length; i++) Wiki.ingest(wiki, envelopes[i])
        renderCurrent()
    }

    function rememberEnvelope(envelope) {
        var event = Wiki.verify(envelope)
        if (!event || wiki.has(event.id)) return
        Wiki.ingest(wiki, envelope)
        envelopes.push(envelope)
        kvSet("envelopes", JSON.stringify(envelopes))
    }

    function renderCurrent() {
        var hop = Wiki.followRedirect(wiki, currentTitle)
        if (hop.hops && hop.title !== currentTitle) currentTitle = hop.title
        article = Wiki.renderPage(wiki, currentTitle, userKey !== "" && Wiki.canEditPage(wiki, userKey, currentTitle))
        if (mode === "article" || mode === "missing") mode = article.missing ? "missing" : "article"
    }

    function openTitle(title) {
        if (!title) return
        if (title === "Special:Random") {
            var titles = Wiki.pageTitles(wiki)
            if (!titles.length) {
                notice = "No pages yet."
                return
            }
            openTitle(titles[Math.floor(Math.random() * titles.length)])
            return
        }
        if (/^Special:/i.test(title)) {
            currentTitle = title
            mode = "special"
            return
        }
        currentTitle = title
        mode = "article"
        renderCurrent()
    }

    function openLink(link) {
        if (!link) return
        if (link.indexOf("http://") === 0 || link.indexOf("https://") === 0) {
            notice = "Open in a browser: " + link
            return
        }
        var title = Wiki.parseWikiLink(link)
        if (title) openTitle(title)
    }

    function parseResult(payload) {
        if (payload === null || payload === undefined) return { success: false, error: "empty result" }
        if (typeof payload === "boolean" || typeof payload === "number") return { success: true, value: payload }
        if (typeof payload === "object") {
            if (payload.success === undefined && payload.error === undefined) return { success: true, value: payload }
            return payload
        }
        try {
            var parsed = JSON.parse(payload)
            if (parsed && typeof parsed === "object") {
                if (parsed.success === undefined && parsed.error === undefined) return { success: true, value: parsed }
                return parsed
            }
            return { success: true, value: parsed }
        } catch (e) {
            return { success: true, value: payload }
        }
    }

    function isOk(result) {
        if (!result) return false
        if (result.success === false) return false
        if (result.value === false) return false
        return true
    }

    function callMod(mod, method, args, cb) {
        if (!hasLogos) {
            cb({ success: false, error: "Logos bridge is not available" })
            return
        }
        logos.callModuleAsync(mod, method, args, function (payload) { cb(parseResult(payload)) })
    }

    function eventPayload(data) {
        if (!data || data.length === undefined) return data
        var first = data[0]
        if (typeof first === "string" && (first.charAt(0) === "{" || first.charAt(0) === "[")) {
            try { return JSON.parse(first) } catch (e) {}
        }
        if (first && typeof first === "object") return first
        return data
    }

    function onLogosEvent(moduleName, eventName, data) {
        if (moduleName === "delivery_module" && eventName === "connectionStateChanged") {
            deliveryStatus = String((eventPayload(data) && eventPayload(data).status) || data[0] || deliveryStatus)
            return
        }
        if (moduleName === "delivery_module" && eventName === "messageReceived") {
            var topic = data[1]
            if (topic && topic !== Wiki.TOPIC) return
            var text = Wiki.decodeMessage(data[2])
            if (!text) return
            var message
            try { message = JSON.parse(text) } catch (e) { return }
            if (message && typeof message.snapshot === "string") downloadSnapshot(message.snapshot)
            else rememberEnvelope(message)
            renderCurrent()
            return
        }
        if (moduleName !== "storage_module") return
        var payload = eventPayload(data)
        if (eventName === "storageDownloadProgress" && payload && payload.chunk && payload.sessionId) {
            if (!dlChunks[payload.sessionId]) dlChunks[payload.sessionId] = []
            dlChunks[payload.sessionId].push(payload.chunk)
            busyText = "Downloading snapshot…"
        }
        if (eventName === "storageDownloadDone" && payload && payload.sessionId) {
            var chunks = dlChunks[payload.sessionId] || []
            delete dlChunks[payload.sessionId]
            busyText = ""
            if (!payload.success) {
                notice = payload.error || "Snapshot download failed"
                return
            }
            ingestSnapshot(Wiki.joinBase64Chunks(chunks))
        }
    }

    function ingestSnapshot(text) {
        var lines = text.split("\n")
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i]) continue
            try { rememberEnvelope(JSON.parse(lines[i])) } catch (e) {}
        }
        renderCurrent()
        notice = "Loaded " + wiki.log.length + " events"
    }

    function downloadSnapshot(cid) {
        if (!cid || storageStatus !== "online") return
        busyText = "Fetching snapshot…"
        callMod("storage_module", "downloadChunks", [cid, false, 65536], function (result) {
            if (!result.success) {
                busyText = ""
                notice = result.error || "downloadChunks failed"
            }
        })
    }

    function startStorage() {
        callMod("storage_module", "isRunning", [], function (running) {
            if (isOk(running) && (running.value === true || running.value === "true" || running.success === true)) {
                storageStatus = "online"
                if (snapshotCid) downloadSnapshot(snapshotCid)
                return
            }
            callMod("storage_module", "loadConfigOrDefault", [], function (cfg) {
                var conf = cfg.value !== undefined ? cfg.value : ""
                callMod("storage_module", "init", [typeof conf === "string" ? conf : JSON.stringify(conf)], function () {
                    callMod("storage_module", "start", [], function (started) {
                        storageStatus = isOk(started) ? "online" : "error"
                        if (!isOk(started)) notice = started.error || "storage_module did not start"
                        else if (snapshotCid) downloadSnapshot(snapshotCid)
                    })
                })
            })
        })
    }

    function subscribeTopic() {
        callMod("delivery_module", "subscribe", [Wiki.TOPIC], function (result) {
            deliveryStatus = isOk(result) ? "online" : "error"
            if (!isOk(result)) notice = result.error || "subscribe failed"
        })
    }

    function startDelivery() {
        callMod("delivery_module", "getConnectionStatus", [], function (status) {
            if (status.success && status.value && status.value !== "Disconnected") {
                subscribeTopic()
                return
            }
            callMod("delivery_module", "createNode", [JSON.stringify({ mode: "Edge", preset: Wiki.PRESET })], function (created) {
                if (!created.success && created.error && String(created.error).indexOf("already") < 0) {
                    notice = created.error
                    deliveryStatus = "error"
                    return
                }
                callMod("delivery_module", "start", [], function () { subscribeTopic() })
            })
        })
    }

    function sendEnvelope(envelope, okText) {
        var payload = JSON.stringify(envelope)
        rememberEnvelope(envelope)
        renderCurrent()
        if (!hasLogos) {
            notice = (okText || "Saved locally") + " (Delivery is offline)"
            return
        }
        callMod("delivery_module", "send", [Wiki.TOPIC, payload], function (result) {
            notice = isOk(result) ? (okText || "Published") : (result.error || "send failed")
        })
    }

    function applySession(seed, name, remember, created) {
        seedHex = Wiki.bytesToHex(seed)
        userKey = Wiki.publicKey(seed)
        userName = Wiki.accountName(wiki, userKey)
        if (remember) kvSet("session", JSON.stringify({ seedHex: seedHex, name: name }))
        else kvSet("session", "")
        if (created) {
            userName = userName || name
            notice = "Account created"
            mode = "article"
            return
        }
        if (userName && userName !== name) notice = "This password belongs to " + userName
        else if (!userName) notice = "No account for this name and password. Create one?"
        else {
            notice = "Signed in as " + userName
            mode = "article"
        }
    }

    function login(name, password, remember) {
        busyText = "Deriving key…"
        try {
            applySession(Wiki.deriveSeed(name, password), name, remember, false)
        } catch (err) {
            notice = String(err)
        }
        busyText = ""
    }

    function createAccount(name, password, remember) {
        var valid = Wiki.validUsername(name)
        if (!valid || valid !== name) {
            notice = "Use a MediaWiki user name, without a User: prefix."
            return
        }
        busyText = "Deriving key…"
        try {
            var seed = Wiki.deriveSeed(name, password)
            userKey = Wiki.publicKey(seed)
            if (wiki.names.get(userKey) || wiki.accounts.get(name)) {
                notice = "That account already exists. Log in instead."
                busyText = ""
                return
            }
            sendEnvelope(Wiki.sign(seed, { t: "account", name: name }), "Account created")
            applySession(seed, name, remember, true)
        } catch (err) {
            notice = String(err)
        }
        busyText = ""
    }

    function logout() {
        userName = ""
        userKey = ""
        seedHex = ""
        kvSet("session", "")
        notice = "Signed out"
    }

    function saveSettings(nextAdmin, nextSnapshot) {
        adminKey = (nextAdmin || "").toLowerCase()
        snapshotCid = nextSnapshot || ""
        kvSet("adminKey", adminKey)
        kvSet("snapshotCid", snapshotCid)
        resetWiki()
        if (snapshotCid && storageStatus === "online") downloadSnapshot(snapshotCid)
        notice = "Settings saved"
        mode = "article"
    }

    function publishEdit(title, text, summary) {
        if (!seedHex) {
            mode = "login"
            notice = "Log in to edit."
            return
        }
        if (!Wiki.canEditPage(wiki, userKey, title)) {
            notice = "You cannot edit this page."
            return
        }
        sendEnvelope(Wiki.publishBody(seedHex, { t: "edit", title: title, text: text, summary: summary || "" }), "Edit published")
        currentTitle = title
        mode = "article"
        renderCurrent()
    }

    function boot() {
        adminKey = kvGet("adminKey", "")
        snapshotCid = kvGet("snapshotCid", "")
        try { envelopes = JSON.parse(kvGet("envelopes", "[]")) } catch (e) { envelopes = [] }
        if (!(envelopes instanceof Array)) envelopes = []
        try {
            var session = JSON.parse(kvGet("session", "null"))
            if (session && session.seedHex) {
                seedHex = session.seedHex
                userKey = Wiki.publicKey(Wiki.hexToBytes(seedHex))
            }
        } catch (e) {}
        resetWiki()
        if (userKey) userName = Wiki.accountName(wiki, userKey)
        if (!hasLogos) {
            notice = "Running without the Logos bridge. Pages come from the local cache only."
            return
        }
        logos.onModuleEvent("delivery_module", "messageReceived")
        logos.onModuleEvent("delivery_module", "connectionStateChanged")
        logos.onModuleEvent("storage_module", "storageDownloadProgress")
        logos.onModuleEvent("storage_module", "storageDownloadDone")
        startStorage()
        startDelivery()
    }

    Connections {
        target: root.hasLogos ? logos : null
        function onModuleEventReceived(moduleName, eventName, data) {
            root.onLogosEvent(moduleName, eventName, data)
        }
        function onIntentRequested(requestId, intent, params, requesterName) {
            if (intent === "wiki.open") {
                if (params && params.title) root.openTitle(params.title)
                logos.respond(requestId, true, {}, "")
            }
        }
    }

    Component.onCompleted: boot()

    Rectangle {
        anchors.fill: parent
        color: root.wash
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            color: root.header
            border.color: root.line
            border.width: 0

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                spacing: 12

                Text {
                    text: Wiki.SITENAME
                    color: root.ink
                    font.pixelSize: 20
                    font.bold: true
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.openTitle(Wiki.MAIN_PAGE)
                    }
                }
                Text {
                    text: "Logos Wiki"
                    color: root.muted
                    font.pixelSize: 12
                }
                Item { Layout.fillWidth: true }
                TextField {
                    id: searchField
                    Layout.preferredWidth: 220
                    placeholderText: "Search or go to"
                    selectByMouse: true
                    onAccepted: root.openTitle(text)
                }
                Button {
                    text: "Go"
                    onClicked: root.openTitle(searchField.text)
                }
                Button {
                    text: root.userName ? root.userName : "Log in"
                    onClicked: root.mode = root.userName ? "account" : "login"
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: notice.length || busyText.length ? 28 : 0
            color: "#fef6e7"
            visible: height > 0
            Text {
                anchors.verticalCenter: parent.verticalCenter
                anchors.left: parent.left
                anchors.leftMargin: 16
                text: root.busyText || root.notice
                color: root.ink
                font.pixelSize: 12
            }
        }

        SplitView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            orientation: Qt.Horizontal

            Rectangle {
                SplitView.preferredWidth: 200
                SplitView.minimumWidth: 160
                color: root.wash

                Column {
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 8

                    Repeater {
                        model: [
                            { label: "Main Page", title: Wiki.MAIN_PAGE },
                            { label: "Recent changes", title: "Special:RecentChanges" },
                            { label: "All pages", title: "Special:AllPages" },
                            { label: "Random page", title: "Special:Random" },
                            { label: "Special pages", title: "Special:SpecialPages" },
                            { label: "Settings", title: "Special:Settings" }
                        ]
                        Text {
                            text: modelData.label
                            color: root.link
                            font.pixelSize: 13
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: root.openTitle(modelData.title)
                            }
                        }
                    }

                    Item { height: 16 }
                    Text {
                        text: "Delivery: " + root.deliveryStatus
                        color: root.muted
                        font.pixelSize: 11
                    }
                    Text {
                        text: "Storage: " + root.storageStatus
                        color: root.muted
                        font.pixelSize: 11
                    }
                    Text {
                        text: wiki && wiki.stats ? wiki.stats().pages + " pages" : ""
                        color: root.muted
                        font.pixelSize: 11
                    }
                }
            }

            Rectangle {
                SplitView.fillWidth: true
                color: root.paper

                ColumnLayout {
                    anchors.fill: parent
                    spacing: 0

                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 44
                        color: root.paper
                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 28
                            anchors.rightMargin: 16
                            Text {
                                text: root.currentTitle
                                color: root.ink
                                font.pixelSize: 22
                                font.bold: true
                                Layout.fillWidth: true
                                elide: Text.ElideRight
                            }
                            Button {
                                text: "Read"
                                visible: !/^Special:/i.test(root.currentTitle)
                                onClicked: { root.mode = "article"; root.renderCurrent() }
                            }
                            Button {
                                text: "Edit"
                                visible: !/^Special:/i.test(root.currentTitle)
                                enabled: root.userKey !== "" && Wiki.canEditPage(wiki, root.userKey, root.currentTitle)
                                onClicked: root.mode = "edit"
                            }
                            Button {
                                text: "History"
                                visible: !/^Special:/i.test(root.currentTitle)
                                onClicked: root.mode = "history"
                            }
                        }
                    }
                    Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: root.line }

                    Loader {
                        id: pageLoader
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        sourceComponent: {
                            if (root.mode === "edit") return editPage
                            if (root.mode === "history") return historyPage
                            if (root.mode === "login" || root.mode === "create") return authPage
                            if (root.mode === "account") return accountPage
                            if (root.mode === "special" || /^Special:/i.test(root.currentTitle)) return specialPage
                            return articlePage
                        }
                    }
                }
            }
        }
    }

    Component {
        id: articlePage
        Flickable {
            clip: true
            contentWidth: width
            contentHeight: body.implicitHeight + 48
            ScrollBar.vertical: ScrollBar {}
            Text {
                id: body
                width: parent.width - 56
                x: 28
                y: 16
                wrapMode: Text.Wrap
                textFormat: Text.RichText
                color: root.ink
                font.pixelSize: 15
                text: root.article && root.article.html ? root.article.html : ""
                onLinkActivated: root.openLink(link)
            }
        }
    }

    Component {
        id: editPage
        EditPage {
            pageTitle: root.currentTitle
            source: root.article && root.article.source ? root.article.source : ""
            previewFn: function (text) {
                var title = Wiki.parseTitle(root.currentTitle)
                if (!title) return "<p>Invalid title.</p>"
                return Wiki.richText(Wiki.render(text, {
                    title: title,
                    exists: function (full) { return wiki.pages.has(full) },
                    template: function (full) { return Wiki.latestText(wiki, full) },
                    file: function () { return null },
                    stats: wiki.stats()
                }).html)
            }
            onCancelled: { root.mode = "article"; root.renderCurrent() }
            onPublished: root.publishEdit(root.currentTitle, text, summary)
        }
    }

    Component {
        id: historyPage
        HistoryPage {
            revisions: {
                var page = wiki.pages.get(root.currentTitle)
                return page ? page.revs.slice().reverse() : []
            }
        }
    }

    Component {
        id: authPage
        AuthPage {
            creating: root.mode === "create"
            onLoginRequested: root.login(name, password, remember)
            onCreateRequested: root.createAccount(name, password, remember)
            onSwitchMode: root.mode = root.mode === "create" ? "login" : "create"
        }
    }

    Component {
        id: accountPage
        Flickable {
            clip: true
            contentHeight: col.implicitHeight + 32
            Column {
                id: col
                x: 28
                y: 16
                width: parent.width - 56
                spacing: 12
                Text { text: "Signed in as " + root.userName; font.pixelSize: 16; color: root.ink }
                Text { text: "Key: " + root.userKey; font.pixelSize: 12; color: root.muted; wrapMode: Text.Wrap; width: parent.width }
                Button { text: "Log out"; onClicked: { root.logout(); root.mode = "article" } }
            }
        }
    }

    Component {
        id: specialPage
        SpecialPage {
            title: root.currentTitle
            wiki: root.wiki
            adminKey: root.adminKey
            snapshotCid: root.snapshotCid
            onOpenTitle: root.openTitle(name)
            onSaveSettings: root.saveSettings(nextAdmin, nextSnapshot)
        }
    }
}
