import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export default function Dashboard() {
  const skillsRef = useRef<HTMLDivElement>(null)
  const projectsRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const darkText = '#c8cdd8'
    const accentColor = '#6b8cff'
    const gridColor = 'rgba(107,140,255,0.08)'

    // 1. 技能雷达图
    if (skillsRef.current) {
      const chart = echarts.init(skillsRef.current)
      chart.setOption({
        title: { text: '技能雷达', textStyle: { color: darkText, fontSize: 13, fontWeight: 500 }, left: 10, top: 5 },
        radar: {
          indicator: [
            { name: 'React', max: 100 },
            { name: 'TypeScript', max: 100 },
            { name: 'Monorepo', max: 100 },
            { name: 'AI 工程化', max: 100 },
            { name: '动画/3D', max: 100 },
            { name: '工程化', max: 100 },
          ],
          radius: '65%',
          axisName: { color: darkText, fontSize: 11 },
          splitArea: { areaStyle: { color: ['rgba(107,140,255,0.02)', 'rgba(107,140,255,0.05)'] } },
          splitLine: { lineStyle: { color: gridColor } },
          axisLine: { lineStyle: { color: gridColor } },
        },
        series: [{
          type: 'radar',
          data: [{
            value: [92, 88, 90, 95, 80, 85],
            name: '技能水平',
            areaStyle: { color: 'rgba(107,140,255,0.2)' },
            lineStyle: { color: accentColor, width: 2 },
            itemStyle: { color: accentColor },
          }],
        }],
      })
      return () => chart.dispose()
    }
  }, [])

  useEffect(() => {
    const darkText = '#c8cdd8'

    // 2. 项目经验饼图
    if (projectsRef.current) {
      const chart = echarts.init(projectsRef.current)
      chart.setOption({
        title: { text: '项目经验分布', textStyle: { color: darkText, fontSize: 13, fontWeight: 500 }, left: 10, top: 5 },
        tooltip: { trigger: 'item', backgroundColor: '#1a2a4a', borderColor: '#2a3a5a', textStyle: { color: '#fff' } },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#0a1628', borderWidth: 2 },
          label: { color: darkText, fontSize: 11, formatter: '{b}\n{d}%' },
          data: [
            { value: 35, name: '工程架构', itemStyle: { color: '#4f6ef7' } },
            { value: 25, name: 'AI 工程化', itemStyle: { color: '#6b8cff' } },
            { value: 20, name: '业务开发', itemStyle: { color: '#8b5cf6' } },
            { value: 20, name: '工具开发', itemStyle: { color: '#06b6d4' } },
          ],
        }],
      })
      return () => chart.dispose()
    }
  }, [])

  useEffect(() => {
    const darkText = '#c8cdd8'
    const gridColor = 'rgba(107,140,255,0.08)'

    // 3. 工作经历时间轴
    if (timelineRef.current) {
      const chart = echarts.init(timelineRef.current)
      chart.setOption({
        title: { text: '工作经历时间轴', textStyle: { color: darkText, fontSize: 13, fontWeight: 500 }, left: 10, top: 5 },
        tooltip: { trigger: 'axis', backgroundColor: '#1a2a4a', borderColor: '#2a3a5a', textStyle: { color: '#fff' } },
        grid: { left: 80, right: 30, top: 40, bottom: 30 },
        xAxis: {
          type: 'category',
          data: ['2020.12', '2021.12', '2022.06', '2023.01', '2023.06', '2023.12', '2024.05', '2024.12', '2025.06', '2026.01', '2026.09'],
          axisLine: { lineStyle: { color: gridColor } },
          axisLabel: { color: darkText, fontSize: 10 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'category',
          data: ['浩鲸云', '法本科技', '博彦科技'],
          axisLine: { lineStyle: { color: gridColor } },
          axisLabel: { color: darkText, fontSize: 11 },
          splitLine: { lineStyle: { color: gridColor } },
        },
        series: [{
          type: 'line',
          data: [
            { value: [0, 0], itemStyle: { color: '#06b6d4' } },
            { value: [1, 0], itemStyle: { color: '#06b6d4' } },
            { value: [1, 1], itemStyle: { color: '#8b5cf6' } },
            { value: [6, 1], itemStyle: { color: '#8b5cf6' } },
            { value: [6, 2], itemStyle: { color: '#4f6ef7' } },
            { value: [10, 2], itemStyle: { color: '#4f6ef7' } },
          ],
          lineStyle: { width: 3, color: '#4f6ef7' },
          symbol: 'circle',
          symbolSize: 10,
          itemStyle: { borderColor: '#0a1628', borderWidth: 2 },
          label: {
            show: true,
            color: darkText,
            fontSize: 11,
            formatter: (p: { data: number[] }) => {
              const labels = ['浩鲸云·福州', '法本·杭州', '博彦·杭州']
              return labels[p.data[1]] || ''
            },
            position: 'top',
          },
        }],
      })
      return () => chart.dispose()
    }
  }, [])

  // 响应式
  useEffect(() => {
    const handleResize = () => {
      const charts = [skillsRef, projectsRef, timelineRef]
      charts.forEach(ref => {
        if (ref.current) {
          const instance = echarts.getInstanceByDom(ref.current)
          instance?.resize()
        }
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="dashboard">
      <div className="dashboard-title">个人技能 & 项目数据看板</div>
      <div className="dashboard-grid">
        <div className="chart-box">
          <div className="chart-container" ref={skillsRef} />
        </div>
        <div className="chart-box">
          <div className="chart-container" ref={projectsRef} />
        </div>
        <div className="chart-box full">
          <div className="chart-container tall" ref={timelineRef} />
        </div>
      </div>
    </div>
  )
}
