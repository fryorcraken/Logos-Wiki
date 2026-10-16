import QtQuick 2.15
import QtQuick.Controls 2.15
import "wiki.js" as Wiki

Flickable {
    property var revisions: []
    clip: true
    contentHeight: col.implicitHeight + 32
    ScrollBar.vertical: ScrollBar {}

    Column {
        id: col
        x: 20
        y: 12
        width: parent.width - 40
        spacing: 8

        Text {
            text: revisions && revisions.length ? revisions.length + " revisions" : "No history yet."
            color: "#54595d"
            font.pixelSize: 15
        }

        Repeater {
            model: revisions || []
            Rectangle {
                width: col.width
                height: row.implicitHeight + 12
                color: index % 2 ? "#f8f9fa" : "#ffffff"
                Row {
                    id: row
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.verticalCenter: parent.verticalCenter
                    anchors.margins: 8
                    spacing: 12
                    Text { text: String(modelData.id); width: 48; color: "#54595d"; font.pixelSize: 14 }
                    Text { text: Wiki.formatDateTime(modelData.ts); width: 180; color: "#202122"; font.pixelSize: 14 }
                    Text { text: modelData.user; width: 120; color: "#3366cc"; font.pixelSize: 14 }
                    Text {
                        text: modelData.summary || (modelData.minor ? "m" : "")
                        width: parent.width - 380
                        elide: Text.ElideRight
                        color: "#202122"
                        font.pixelSize: 14
                    }
                }
            }
        }
    }
}
