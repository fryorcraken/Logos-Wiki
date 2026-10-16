import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "wiki.js" as Wiki

Flickable {
    id: root
    property string title: ""
    property string adminKey: ""
    property string snapshotCid: ""
    property bool isAdmin: false
    property bool dark: false
    signal openTitle(string name)
    signal saveSettings(string nextAdmin, string nextSnapshot)
    signal saveTrusted(string editors)

    readonly property color ink: dark ? "#eaecf0" : "#202122"
    readonly property color muted: dark ? "#a2a9b1" : "#54595d"
    readonly property color line: dark ? "#54595d" : "#a2a9b1"
    readonly property color paper: dark ? "#101418" : "#ffffff"
    readonly property color link: dark ? "#88a3e8" : "#3366cc"

    clip: true
    contentHeight: body.implicitHeight + 40
    ScrollBar.vertical: ScrollBar {}

    function items() {
        if (title === "Special:RecentChanges") return Wiki.engineRecent(100)
        if (title === "Special:AllPages") {
            return Wiki.engineTitles().map(function (name) { return { page: name } })
        }
        if (title === "Special:SpecialPages") {
            return [
                { page: "Special:RecentChanges", label: "Recent changes" },
                { page: "Special:AllPages", label: "All pages" },
                { page: "Special:TrustedEditors", label: "Trusted editors" },
                { page: "Special:Settings", label: "Settings" }
            ]
        }
        if (title === "Special:TrustedEditors") {
            return (Wiki.engineTrusted() || []).map(function (name) { return { page: "User:" + name, label: name } })
        }
        return []
    }

    Column {
        id: body
        x: 20
        y: 12
        width: parent.width - 40
        spacing: 10

        Text {
            visible: title === "Special:TrustedEditors"
            width: parent.width
            wrapMode: Text.Wrap
            color: root.muted
            font.pixelSize: 15
            text: "Trusted editors can edit every page except those in the MediaWiki namespace, and can upload files. Other registered users can edit their own user and user talk pages. Only the administrator can change this list."
        }

        Text {
            visible: title === "Special:TrustedEditors" && !(Wiki.engineTrusted() || []).length && !root.isAdmin
            width: parent.width
            wrapMode: Text.Wrap
            color: root.muted
            font.pixelSize: 14
            text: "There are no trusted editors yet."
        }

        Repeater {
            model: title === "Special:Settings" ? [] : root.items()
            Text {
                text: {
                    if (modelData.label) return modelData.label
                    if (modelData.user) return Wiki.formatDateTime(modelData.ts) + " — " + modelData.user + " edited " + modelData.page + (modelData.summary ? " (" + modelData.summary + ")" : "")
                    return modelData.page
                }
                color: root.link
                font.pixelSize: 16
                width: body.width
                wrapMode: Text.Wrap
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.openTitle(modelData.page)
                }
            }
        }

        Column {
            visible: title === "Special:Settings"
            width: parent.width
            spacing: 8
            Text {
                width: parent.width
                wrapMode: Text.Wrap
                color: root.muted
                text: "Defaults are already set so the imported wiki loads on first open. Change these only to follow a different event log. Empty fields restore the shipped admin key and snapshot CID."
            }
            Text { text: "Topic: " + Wiki.TOPIC; color: root.muted; font.pixelSize: 12 }
            TextField {
                id: adminField
                width: parent.width
                height: 36
                placeholderText: "Admin public key (64 hex chars)"
                text: root.adminKey
                selectByMouse: true
                color: root.ink
                background: Rectangle {
                    radius: 2
                    color: root.paper
                    border.width: 1
                    border.color: adminField.activeFocus ? root.link : root.line
                }
            }
            TextField {
                id: cidField
                width: parent.width
                height: 36
                placeholderText: "Snapshot CID (optional)"
                text: root.snapshotCid
                selectByMouse: true
                color: root.ink
                background: Rectangle {
                    radius: 2
                    color: root.paper
                    border.width: 1
                    border.color: cidField.activeFocus ? root.link : root.line
                }
            }
            WikiButton {
                primary: true
                dark: root.dark
                text: "Save"
                onClicked: root.saveSettings(adminField.text.trim(), cidField.text.trim())
            }
        }

        Column {
            visible: title === "Special:TrustedEditors" && root.isAdmin
            width: parent.width
            spacing: 8
            Text {
                text: "Edit the list of trusted editors"
                font.pixelSize: 16
                font.bold: true
                color: root.ink
            }
            Text {
                width: parent.width
                wrapMode: Text.Wrap
                color: root.muted
                font.pixelSize: 14
                text: "One username per line. Trusted editors can edit every page outside the MediaWiki namespace and upload files."
            }
            TextArea {
                id: editorsField
                width: parent.width
                height: 180
                wrapMode: TextArea.Wrap
                selectByMouse: true
                font.family: "monospace"
                color: root.ink
                text: (Wiki.engineTrusted() || []).join("\n")
                background: Rectangle {
                    color: root.paper
                    border.width: 1
                    border.color: editorsField.activeFocus ? root.link : root.line
                }
            }
            WikiButton {
                primary: true
                dark: root.dark
                text: "Save trusted editors"
                onClicked: root.saveTrusted(editorsField.text)
            }
        }
    }
}
