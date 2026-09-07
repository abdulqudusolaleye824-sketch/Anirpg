param([string]$Path)

# Compute a content hash of the file with line endings NORMALISED to LF,
# so CRLF/LF differences (harmless) don't show as "different". Genuine
# content changes still surface. Prints the SHA-256 in lowercase hex.

try {
  $c = [System.IO.File]::ReadAllText($Path)
} catch {
  # Binary or unreadable: fall back to raw bytes so we still flag it.
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $h = $sha.ComputeHash($bytes)
  ([System.BitConverter]::ToString($h)).Replace('-', '').ToLower()
  exit
}

$c = $c -replace "`r`n", "`n" -replace "`r", "`n"
$sha = [System.Security.Cryptography.SHA256]::Create()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($c)
$h = $sha.ComputeHash($bytes)
([System.BitConverter]::ToString($h)).Replace('-', '').ToLower()
