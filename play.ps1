$player = New-Object -ComObject WMPlayer.OCX
$player.URL = "c:\Users\saima\OneDrive\Desktop\bhai\src\audio.mpeg"
$player.controls.play()
Start-Sleep -Seconds 2
