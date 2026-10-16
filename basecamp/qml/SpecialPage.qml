import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "wiki.js" as Wiki

Flickable {
    id: root
    property string title: ""
    property var wiki
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
        if (!wiki) return []
        if (title === "Special:RecentChanges") return Wiki.recent(wiki, 100)
        if (title === "Special:AllPages") {
            return Wiki.pageTitles(wiki).map(function (name) { return { page: name } })
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
            return (wiki.trusted || []).map(function (name) { return { page: "User:" + name, label: name } })
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
            text: (wiki && wiki.trusted && wiki.trusted.length)
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
                text: "The admin public key is required to replay imported history and trust. Paste the same WIKI_ADMIN_KEY the web instance uses. Snapshot CID bootstraps the log from Storage."
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
            Button {
                text: "Save"
                onClicked: root.saveSettings(adminField.text.trim(), cidField.text.trim())
            }
        }
    }
}
