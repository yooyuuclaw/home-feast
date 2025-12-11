@echo off
REM ========================================
REM 健康小本本 - 代码重构一键部署脚本
REM ========================================

echo.
echo ========================================
echo   健康小本本 - 代码重构部署工具
echo ========================================
echo.

set HEALTH_DIR=D:\微信小程序开发\聚餐\miniprogram\pages\health

echo [1] 检查文件...
if not exist "%HEALTH_DIR%\health.js" (
    echo [错误] 未找到 health.js
    pause
    exit /b 1
)

if not exist "%HEALTH_DIR%\health-refactored.js" (
    echo [错误] 未找到 health-refactored.js
    pause
    exit /b 1
)

echo [✓] 文件检查通过
echo.

echo [2] 选择操作:
echo     1 - 部署重构版本 (备份原文件)
echo     2 - 恢复原版本
echo     3 - 退出
echo.

set /p choice="请输入选择 (1/2/3): "

if "%choice%"=="1" goto deploy
if "%choice%"=="2" goto restore
if "%choice%"=="3" goto end
echo [错误] 无效的选择
pause
exit /b 1

:deploy
echo.
echo [3] 开始部署重构版本...

REM 检查是否已有备份
if exist "%HEALTH_DIR%\health.js.backup" (
    echo [警告] 发现已存在的备份文件
    set /p overwrite="是否覆盖旧备份? (y/n): "
    if /i not "%overwrite%"=="y" (
        echo [取消] 部署已取消
        pause
        exit /b 1
    )
)

REM 备份原文件
echo [3.1] 备份原文件 health.js -> health.js.backup
copy /y "%HEALTH_DIR%\health.js" "%HEALTH_DIR%\health.js.backup" >nul
if errorlevel 1 (
    echo [错误] 备份失败
    pause
    exit /b 1
)
echo [✓] 备份成功

REM 部署重构版本
echo [3.2] 部署重构版本 health-refactored.js -> health.js
copy /y "%HEALTH_DIR%\health-refactored.js" "%HEALTH_DIR%\health.js" >nul
if errorlevel 1 (
    echo [错误] 部署失败
    pause
    exit /b 1
)
echo [✓] 部署成功

echo.
echo ========================================
echo   重构版本部署完成！
echo ========================================
echo.
echo 接下来请执行:
echo 1. 打开微信开发者工具
echo 2. 重新编译项目
echo 3. 测试所有功能:
echo    - 健康打卡
echo    - 喝水打卡
echo    - 吃药提醒
echo    - 授权管理
echo.
echo 如遇问题, 运行本脚本选择 [2] 恢复原版本
echo ========================================
pause
goto end

:restore
echo.
echo [3] 开始恢复原版本...

if not exist "%HEALTH_DIR%\health.js.backup" (
    echo [错误] 未找到备份文件 health.js.backup
    pause
    exit /b 1
)

echo [3.1] 恢复备份 health.js.backup -> health.js
copy /y "%HEALTH_DIR%\health.js.backup" "%HEALTH_DIR%\health.js" >nul
if errorlevel 1 (
    echo [错误] 恢复失败
    pause
    exit /b 1
)
echo [✓] 恢复成功

echo.
echo ========================================
echo   原版本恢复完成！
echo ========================================
echo.
echo 已恢复到重构前的版本
echo 请重新编译项目测试
echo ========================================
pause
goto end

:end
echo.
echo 脚本执行完毕
pause
