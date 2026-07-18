param(
    [string]$BaseUrl = "http://localhost:3100"
)

$ErrorActionPreference = "Stop"

function Invoke-AgentBrowser {
    param([string[]]$BrowserArguments)

    $output = & npx.cmd --yes agent-browser @BrowserArguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($output -join "`n")
    }
    return ($output -join "`n")
}

function Assert-BrowserTrue {
    param(
        [string]$Expression,
        [string]$FailureMessage
    )

    $result = Invoke-AgentBrowser -BrowserArguments @("eval", $Expression)
    if ($result.Trim() -ne "true") {
        throw "$FailureMessage; output: $result"
    }
}

$routes = @(
    @{ Path = "/demo"; Expression = "document.title.startsWith('StackWorth') && document.body.innerText.length > 500" },
    @{ Path = "/demo/decisions"; Expression = "document.querySelector('h1')?.textContent?.trim() === '\u6c7a\u7b56\u65e5\u8a8c Demo'" },
    @{ Path = "/demo/history"; Expression = "document.querySelector('h1')?.textContent?.trim() === '\u6b77\u53f2\u56de\u653e Demo'" },
    @{ Path = "/demo/whatif"; Expression = "document.querySelector('h1')?.textContent?.trim() === '\u58d3\u529b\u8207\u8cb7\u524d\u6aa2\u6838 Demo'" },
    @{ Path = "/demo/report"; Expression = "document.querySelector('h1')?.textContent?.trim() === '2026-07 \u6708\u5ea6\u6295\u8cc7\u5831\u544a'" }
)

try {
    foreach ($route in $routes) {
        Invoke-AgentBrowser -BrowserArguments @("open", "$BaseUrl$($route.Path)") | Out-Null
        $pageExpression = "($($route.Expression)) && !/Runtime Error|Application error|Failed to compile|Internal Server Error/i.test(document.body.innerText)"
        Assert-BrowserTrue -Expression $pageExpression -FailureMessage "$($route.Path) is missing expected content or displays a runtime error"
        Write-Host "PASS $($route.Path)"
    }

    Invoke-AgentBrowser -BrowserArguments @("set", "viewport", "375", "812") | Out-Null
    Invoke-AgentBrowser -BrowserArguments @("open", "$BaseUrl/demo/whatif") | Out-Null
    Assert-BrowserTrue -Expression "document.documentElement.scrollWidth <= document.documentElement.clientWidth" -FailureMessage "The 375px scenario page has horizontal overflow"

    Invoke-AgentBrowser -BrowserArguments @("set", "viewport", "360", "800") | Out-Null
    Invoke-AgentBrowser -BrowserArguments @("open", "$BaseUrl/demo/report?month=2026-06") | Out-Null
    Assert-BrowserTrue -Expression "document.documentElement.scrollWidth <= document.documentElement.clientWidth" -FailureMessage "The 360px report page has horizontal overflow"

    Write-Host "Browser smoke passed."
} finally {
    Invoke-AgentBrowser -BrowserArguments @("close") | Out-Null
}
