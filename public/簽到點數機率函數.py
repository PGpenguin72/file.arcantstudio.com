# 引入數學模型
import math

# 輸入累積簽到天數（ 1~366 天）
n = input("請輸入累積簽到天數：")
x = int(n)

# 獲得 1 點的機率 設計理念：
# 觀察圖形可視為兩段四分之一的餘弦波銜接（ * 註1）
# 前半段 y 軸平衡位置為 0.25， 後半段為 0.15， 振幅皆為 0.05
# 使用 cos 函數的特性（ cos(0) = 1, cos(π / 2) = 0）
# 實現平滑下降

def Pa(x):
    
    if x <= 183:
        theta = (x / 183) * (math.pi)
        pa = 0.1 * math.cos(theta) + 0.2
        return pa
    else :
        theta = ((x - 183) / 183) * (math.pi)
        pa = 0.1 * math.cos(theta) + 0.1
        return pa

# 獲得 5 點的機率
# 設計使 Pa + Pe = 0.4， 互補的關係
def Pe(x):
    pe = 0.4 - Pa(x)
    return pe

# 獲得 3 點的機率（ 固定為常數函數）
def Pc(x):
    return 0.2

# 獲得 2 點的機率
# 設計理念： 前半段是小振幅的餘弦波下降， 後半段是正弦波上升
def Pb(x):
    if x <= 183:
        theta = (x / 183) * (math.pi)
        return 0.025 * math.cos(theta) + 0.225
    
    elif x > 183:
        theta = ((x - 183) / 183) * (math.pi)
        pb = 0.025 * math.cos(theta) + 0.1125
        return pb

# 獲得 4 點的機率
# 設計使 Pb + Pd = 0.4， 互補的關係
def Pd(x):
    pd = 0.4 - Pb(x)
    return pd

# 顯示所有機率結果
print(f"累積簽到天數：{x}")
print(f"Pa = {Pa(x):.4f}")
print(f"Pe = {Pe(x):.4f}")
print(f"Pc = {Pc(x):.4f}")
print(f"Pb = {Pb(x):.4f}")
print(f"Pd = {Pd(x):.4f}")

# 驗證機率總和是否為 1
total = Pa(x) + Pb(x) + Pc(x) + Pd(x) + Pe(x)
print(f"機率總和 Sum = {total:.4f}")