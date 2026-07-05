# Creates minimal stub zip files for CI-built artifacts that don't exist locally,
# then runs terraform validate. Safe to run repeatedly — skips stubs that already exist.

$stubs = @("api_authorizer_lambda.zip", "openpyxl_layer.zip")
$emptyZip = [byte[]](80,75,5,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)

foreach ($f in $stubs) {
    $path = Join-Path $PSScriptRoot $f
    if (-not (Test-Path $path)) {
        [IO.File]::WriteAllBytes($path, $emptyZip)
        Write-Host "Created stub: $f"
    }
}

terraform validate
