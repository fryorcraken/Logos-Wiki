import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Item {
    id: root
    property string pageTitle: ""
    property string source: ""
    property string summarySeed: ""
    property bool creating: false
    property bool sectionNew: false
    property bool dark: false
    property var previewFn
    property var diffFn
    signal cancelled
    signal published(string text, string summary, bool minor)
    signal openUrl(string url)

    property string panelKind: ""
    property string panelHtml: ""
    property string error: ""
    property bool busy: false

    readonly property color ink: dark ? "#eaecf0" : "#202122"
    readonly property color muted: dark ? "#a2a9b1" : "#54595d"
    readonly property color line: dark ? "#54595d" : "#a2a9b1"
    readonly property color paper: dark ? "#101418" : "#ffffff"
    readonly property color link: dark ? "#88a3e8" : "#3366cc"
    readonly property string linkHex: dark ? "#88a3e8" : "#3366cc"
    readonly property color danger: dark ? "#fd7865" : "#8b0000"

    onSourceChanged: if (editor) editor.text = source

    function showPanel(kind) {
        if (!kind) return
        root.busy = true
        root.error = ""
        if (kind === "preview" && root.previewFn) root.panelHtml = root.previewFn(editor.text)
        else if (kind === "diff" && root.diffFn) root.panelHtml = root.diffFn(editor.text, summary.text)
        else root.panelHtml = ""
        root.panelKind = kind
        root.busy = false
    }

    function save() {
        root.published(editor.text, summary.text, minor.checked)
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 8

        Text {
            visible: root.error.length
            Layout.fillWidth: true
            wrapMode: Text.Wrap
            color: root.danger
            font.pixelSize: 14
            text: root.error
        }

        Flickable {
            visible: root.panelKind !== ""
            Layout.fillWidth: true
            Layout.preferredHeight: visible ? Math.min(280, parent.height * 0.4) : 0
            clip: true
            contentWidth: width
            contentHeight: panelBody.implicitHeight
            ScrollBar.vertical: ScrollBar {}
            Column {
                id: panelBody
                width: parent.width
                spacing: 6
                Text {
                    visible: root.panelKind === "preview"
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 16
                    font.bold: true
                    color: root.ink
                    text: "Preview"
                }
                Text {
                    visible: root.panelKind === "preview"
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 13
                    color: root.muted
                    text: "Remember that this is only a preview. Your changes have not yet been saved!"
                }
                Text {
                    visible: root.panelKind === "diff"
                    width: parent.width
                    wrapMode: Text.Wrap
                    font.pixelSize: 14
                    font.bold: true
                    color: root.ink
                    text: "Latest revision → Your text"
                }
                Text {
                    width: parent.width
                    wrapMode: Text.Wrap
                    textFormat: Text.RichText
                    font.pixelSize: 14
                    color: root.ink
                    text: root.panelHtml
                }
            }
        }

        TextArea {
            id: editor
            Layout.fillWidth: true
            Layout.fillHeight: true
            wrapMode: TextArea.Wrap
            selectByMouse: true
            font.family: "monospace"
            font.pixelSize: 13
            color: root.ink
            Component.onCompleted: text = root.source
            background: Rectangle {
                color: root.paper
                border.width: 1
                border.color: editor.activeFocus ? root.link : root.line
            }
        }

        Text {
            text: root.sectionNew ? "Subject:" : "Summary:"
            font.pixelSize: 14
            font.weight: Font.DemiBold
            color: root.ink
        }
        TextField {
            id: summary
            Layout.fillWidth: true
            Layout.preferredHeight: 36
            placeholderText: root.sectionNew ? "Section subject" : "Enter a short summary"
            selectByMouse: true
            text: root.summarySeed
            color: root.ink
            background: Rectangle {
                radius: 2
                color: root.paper
                border.width: 1
                border.color: summary.activeFocus ? root.link : root.line
            }
        }

        CheckBox {
            id: minor
            text: "This is a minor edit"
            palette.windowText: root.ink
            palette.text: root.ink
        }

        RowLayout {
            spacing: 8
            WikiButton {
                primary: true
                dark: root.dark
                enabled: !root.busy
                text: root.creating ? "Save page" : "Save changes"
                onClicked: root.save()
            }
            WikiButton {
                dark: root.dark
                enabled: !root.busy
                text: "Show preview"
                onClicked: root.showPanel("preview")
            }
            WikiButton {
                dark: root.dark
                enabled: !root.busy
                text: "Show changes"
                onClicked: root.showPanel("diff")
            }
            WikiButton {
                dark: root.dark
                text: "Cancel"
                onClicked: root.cancelled()
            }
            Text {
                textFormat: Text.RichText
                font.pixelSize: 13
                text: '<a href="https://www.mediawiki.org/wiki/Special:MyLanguage/Help:Editing_pages"><font color="' + root.linkHex + '">Editing help</font></a>'
                onLinkActivated: function (link) { root.openUrl(link) }
            }
        }
    }
}
