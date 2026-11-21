Option Explicit
' Qingyang launcher: start the local server in a hidden window (no console flash).
Dim sh, fs, dir
Set sh = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
dir = fs.GetParentFolderName(WScript.ScriptFullName)

' Resolve Node.js: same candidates as 启动青养.cmd
Dim node
node = ""
Dim runtimeNode, dshNode, pfNode
runtimeNode = dir & "\runtime\node.exe"
dshNode = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
pfNode = "C:\Program Files\nodejs\node.exe"
If fs.FileExists(runtimeNode) Then
  node = runtimeNode
ElseIf fs.FileExists(dshNode) Then
  node = dshNode
ElseIf fs.FileExists(pfNode) Then
  node = pfNode
End If
If node = "" Then
  Dim ps, p
  ps = Split(sh.Environment("PROCESS")("PATH"), ";")
  For Each p In ps
    If p <> "" And fs.FileExists(p & "\node.exe") Then
      node = p & "\node.exe"
      Exit For
    End If
  Next
End If

If node = "" Then
  MsgBox "未找到 Node.js，无法启动青养本地服务。" & vbCrLf & _
         "可直接双击 index.html 打开（社区与数据保存功能不可用）。", 48, "青养 · 食疗健康生活"
  WScript.Quit 1
End If

sh.CurrentDirectory = dir
' Window style 0 = hidden window; bWaitOnReturn = False (do not wait)
sh.Run """" & node & """ """ & dir & "\scripts\server.mjs""", 0, False