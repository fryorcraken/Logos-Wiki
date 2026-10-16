import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "wiki.js" as Wiki

Flickable {
    id: root
    property string title: ""
    property string adminKey: ""
    property string snapshotCid: ""
    signal openTitle(string name)
    signal saveSettings(string nextAdmin, string nextSnapshot)

    clip: true
    contentHeight: body.implicitHeight + 40
    ScrollBar.vertical: ScrollBar {}

    function heading() {
        if (title === "Special:RecentChanges") return "Recent changes"
        if (title === "Special:AllPages") return "All pages"
        if (title === "Special:SpecialPages") return "Special pages"
        if (title === "Special:Settings") return "Settings"
        if (title === "Special:TrustedEditors") return "Trusted editors"
        return title
    }

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
        x: 28
        y: 16
        width: parent.width - 56
        spacing: 10

        Text {
            text: root.heading()
            font.pixelSize: 18
            font.bold: true
            color: "#202122"
        }

        Text {
            visible: title === "Special:TrustedEditors"
            width: parent.width
            wrapMode: Text.Wrap
            color: "#54595d"
            text: (Wiki.engineTrusted().length)
                  ? "These users may edit every page except the MediaWiki namespace."
                  : "No trusted editors yet. Trust events are signed by the admin key."
        }

        Repeater {
            model: title === "Special:Settings" ? [] : root.items()
            Text {
                text: {
                    if (modelData.label) return modelData.label
                    if (modelData.user) return Wiki.formatDateTime(modelData.ts) + " — " + modelData.user + " edited " + modelData.page + (modelData.summary ? " (" + modelData.summary + ")" : "")
                    return modelData.page
                }
                color: "#3366cc"
                font.pixelSize: 14
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
                color: "#54595d"
                text: "Defaults are already set so the imported wiki loads on first open. Change these only to follow a different event log. Empty fields restore the shipped admin key and snapshot CID."
            }
            Text { text: "Topic: " + Wiki.TOPIC; color: "#54595d"; font.pixelSize: 12 }
            TextField {
                id: adminField
                width: parent.width
                height: 36
                placeholderText: "Admin public key (64 hex chars)"
                text: root.adminKey
                selectByMouse: true
            }
            TextField {
                id: cidField
                width: parent.width
                height: 36
                placeholderText: "Snapshot CID (optional)"
                text: root.snapshotCid
                selectByMouse: true
            }
            WikiButton {
                primary: true
                text: "Save"
                onClicked: root.saveSettings(adminField.text.trim(), cidField.text.trim())
            }
        }
    }
}
