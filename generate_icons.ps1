Add-Type -AssemblyName System.Drawing

$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 58, 138))
$g.FillRectangle($brush, 0, 0, 1024, 1024)

$paths = @(
    "apps\customer-mobile\assets\icon.png",
    "apps\customer-mobile\assets\adaptive-icon.png",
    "apps\customer-mobile\assets\splash-icon.png",
    "apps\customer-mobile\assets\favicon.png",
    "apps\operations-mobile\assets\icon.png",
    "apps\operations-mobile\assets\adaptive-icon.png",
    "apps\operations-mobile\assets\splash-icon.png",
    "apps\operations-mobile\assets\favicon.png"
)

foreach ($p in $paths) {
    $dir = [System.IO.Path]::GetDirectoryName($p)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
}

$g.Dispose()
$bmp.Dispose()
Write-Output "Successfully generated valid 1024x1024 PNG images."
