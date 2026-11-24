/* ═══════════════════════════════════════════════════════════════
   IBRA Soft Workshop ERP — التقارير والتحليلات المتقدمة (v3)
   ═══════════════════════════════════════════════════════════════ */

const Reports = {
  period: 'month', // today, week, month, all

  render() {
    const content = document.getElementById('content');
    
    // ─── جلب البيانات ───
    const projects = DB.get('projects') || [];
    const invoices = DB.get('invoices') || [];
    const expenses = DB.get('expenses') || [];
    const orders = DB.get('production_orders') || [];
    const machines = DB.get('machines') || [];
    const materials = DB.get('materials') || [];
    const moves = DB.get('inventory_moves') || [];
    const customers = DB.get('customers') || [];

    // ─── تصفية حسب الفترة ───
    const dateLimit = this.getDateLimit();
    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      if (!dateLimit) return true;
      return new Date(dateStr) >= dateLimit;
    };

    const periodInvoices = invoices.filter(i => inPeriod(i.createdAt));
    const periodExpenses = expenses.filter(e => inPeriod(e.date));
    const periodProjects = projects.filter(p => inPeriod(p.createdAt));
    const periodOrders = orders.filter(o => inPeriod(o.createdAt));
    const periodMoves = moves.filter(m => inPeriod(m.date));

    // ─── الحسابات المالية ───
    let totalSales = 0;
    periodInvoices.forEach(inv => {
      totalSales += (Number(inv.total) || 0);
    });

    let totalCollected = 0;
    periodInvoices.forEach(inv => totalCollected += Number(inv.paidAmount) || 0);

    const totalExpenses = periodExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalCosts = periodProjects.reduce((s, p) => s + (Number(p.totalCost) || 0), 0);
    const netProfit = totalCollected - totalExpenses;

    // ─── المقارنة بالفترة السابقة ───
    const prevLimit = this.getPrevDateLimit();
    const prevInvoices = invoices.filter(i => {
      if (!prevLimit || !i.createdAt) return false;
      const d = new Date(i.createdAt);
      return d >= prevLimit.start && d < prevLimit.end;
    });
    const prevCollected = prevInvoices.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
    const salesGrowth = prevCollected > 0 ? Math.round(((totalCollected - prevCollected) / prevCollected) * 100) : 0;

    // ─── الفواتير حسب الحالة ───
    const paidCount = periodInvoices.filter(i => i.status === 'paid').length;
    const partialCount = periodInvoices.filter(i => i.status === 'partial').length;
    const unpaidCount = periodInvoices.filter(i => i.status === 'unpaid').length;

    // ─── المشاريع ───
    const completedProjects = periodProjects.filter(p => ['completed', 'delivered'].includes(p.status)).length;
    const inProgressProjects = periodProjects.filter(p => p.status === 'in_progress').length;
    const completionRate = periodProjects.length > 0 ? Math.round((completedProjects / periodProjects.length) * 100) : 0;

    // ─── المكائن ───
    const machineStats = machines.map(m => {
      const mOrders = periodOrders.filter(o => o.machineId === m.id);
      const hours = mOrders.reduce((sum, o) => sum + (Number(o.totalHours) || 0), 0);
      return { ...m, hours, revenue: hours * (Number(m.hourlyCost) || 0), ordersCount: mOrders.length };
    }).sort((a, b) => b.hours - a.hours);

    // ─── أفضل العملاء ───
    const customerStats = {};
    periodInvoices.forEach(inv => {
      if (!inv.customerId) return;
      if (!customerStats[inv.customerId]) {
        customerStats[inv.customerId] = { id: inv.customerId, name: inv.customerName, total: 0, count: 0 };
      }
      customerStats[inv.customerId].total += Number(inv.total) || 0;
      customerStats[inv.customerId].count++;
    });
    const topCustomers = Object.values(customerStats).sort((a, b) => b.total - a.total).slice(0, 5);

    // ─── أكثر المواد استهلاكاً ───
    const materialUsage = {};
    periodMoves.filter(m => m.type === 'out').forEach(m => {
      if (!materialUsage[m.materialId]) {
        materialUsage[m.materialId] = { id: m.materialId, name: m.materialName, qty: 0, cost: 0 };
      }
      materialUsage[m.materialId].qty += Number(m.qty) || 0;
      materialUsage[m.materialId].cost += (Number(m.qty) || 0) * (Number(m.unitPrice) || 0);
    });
    const topMaterials = Object.values(materialUsage).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // ─── بيانات آخر 7 أيام ───
    const last7Days = this.getLast7DaysData(invoices);

    // ─── بناء الواجهة ───
    let html = `
      <div class="page-header">
        <h1 class="page-title">التقارير والتحليلات</h1>
        <button class="btn btn-primary" onclick="Reports.printComprehensive()">🖨️ طباعة تقرير شامل</button>
      </div>

      <!-- فلاتر الفترة -->
      <div class="reports-period-filter">
        <button class="rpf-btn ${this.period === 'today' ? 'active' : ''}" onclick="Reports.setPeriod('today')">اليوم</button>
        <button class="rpf-btn ${this.period === 'week' ? 'active' : ''}" onclick="Reports.setPeriod('week')">آخر 7 أيام</button>
        <button class="rpf-btn ${this.period === 'month' ? 'active' : ''}" onclick="Reports.setPeriod('month')">آخر 30 يوم</button>
        <button class="rpf-btn ${this.period === 'all' ? 'active' : ''}" onclick="Reports.setPeriod('all')">الكل</button>
      </div>

      <!-- البطاقة الرئيسية -->
      <div class="report-hero-blue">
        <div class="rhb-title">📊 تقرير الفترة: ${this.getPeriodLabel()}</div>
        <div class="rhb-grid">
          <div class="rhb-item">
            <div class="rhb-label">💰 إجمالي المبيعات</div>
            <div class="rhb-value">${Utils.money(totalSales)}</div>
            <div class="rhb-growth ${salesGrowth >= 0 ? 'positive' : 'negative'}">
              ${salesGrowth >= 0 ? '📈' : '📉'} ${Math.abs(salesGrowth)}% مقارنة بالفترة السابقة
            </div>
          </div>
          <div class="rhb-item">
            <div class="rhb-label">💵 المحصل</div>
            <div class="rhb-value" style="color:#86efac;">${Utils.money(totalCollected)}</div>
          </div>
          <div class="rhb-item">
            <div class="rhb-label">💸 المصروفات</div>
            <div class="rhb-value" style="color:#fca5a5;">${Utils.money(totalExpenses)}</div>
          </div>
          <div class="rhb-item">
            <div class="rhb-label">📈 صافي الربح</div>
            <div class="rhb-value" style="color:${netProfit >= 0 ? '#86efac' : '#fca5a5'};">${Utils.money(netProfit)}</div>
          </div>
        </div>
      </div>

      <!-- صف الإحصائيات السريعة -->
      <div class="reports-kpi-grid">
        <div class="rkpi-card rkpi-projects">
          <div class="rkpi-icon">📁</div>
          <div class="rkpi-info">
            <div class="rkpi-value">${periodProjects.length}</div>
            <div class="rkpi-label">مشاريع الفترة</div>
            <div class="rkpi-sub">${completedProjects} مكتملة • ${inProgressProjects} قيد التنفيذ</div>
          </div>
        </div>
        <div class="rkpi-card rkpi-invoices">
          <div class="rkpi-icon">🧾</div>
          <div class="rkpi-info">
            <div class="rkpi-value">${periodInvoices.length}</div>
            <div class="rkpi-label">فواتير الفترة</div>
            <div class="rkpi-sub">${paidCount} مدفوعة • ${partialCount + unpaidCount} معلقة</div>
          </div>
        </div>
        <div class="rkpi-card rkpi-customers">
          <div class="rkpi-icon">👥</div>
          <div class="rkpi-info">
            <div class="rkpi-value">${Object.keys(customerStats).length}</div>
            <div class="rkpi-label">عملاء نشطون</div>
            <div class="rkpi-sub">خلال هذه الفترة</div>
          </div>
        </div>
        <div class="rkpi-card rkpi-orders">
          <div class="rkpi-icon">🏭</div>
          <div class="rkpi-info">
            <div class="rkpi-value">${periodOrders.length}</div>
            <div class="rkpi-label">أوامر تصنيع</div>
            <div class="rkpi-sub">آخر ${this.getPeriodLabel()}</div>
          </div>
        </div>
      </div>

      <!-- الصف الأوسط -->
      <div class="reports-middle-grid">
        
        <!-- رسم بياني للمبيعات -->
        <div class="card">
          <div class="report-card-header">
            <h3>📈 حركة المبيعات (آخر 7 أيام)</h3>
          </div>
          <div class="reports-chart">
            ${last7Days.map(d => `
              <div class="rc-bar-item">
                <div class="rc-bar-value">${d.amount > 0 ? Utils.num(d.amount, 0) : ''}</div>
                <div class="rc-bar-track">
                  <div class="rc-bar-fill" style="height: ${d.percent}%"></div>
                </div>
                <div class="rc-bar-label">${d.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- حالة الفواتير -->
        <div class="card">
          <div class="report-card-header">
            <h3>🧾 حالة الفواتير</h3>
          </div>
          <div class="invoice-status-chart">
            <div class="isc-donut">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" class="isc-bg"/>
                ${this.renderDonutSegments(paidCount, partialCount, unpaidCount)}
              </svg>
              <div class="isc-center">
                <div class="isc-total">${periodInvoices.length}</div>
                <div class="isc-label">فاتورة</div>
              </div>
            </div>
            <div class="isc-legend">
              <div class="isc-legend-item">
                <span class="isc-dot" style="background:#10b981;"></span>
                <span>مدفوعة</span>
                <b>${paidCount}</b>
              </div>
              <div class="isc-legend-item">
                <span class="isc-dot" style="background:#f59e0b;"></span>
                <span>جزئية</span>
                <b>${partialCount}</b>
              </div>
              <div class="isc-legend-item">
                <span class="isc-dot" style="background:#dc2626;"></span>
                <span>غير مدفوعة</span>
                <b>${unpaidCount}</b>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- أداء المكائن -->
      <div class="card">
        <div class="report-card-header">
          <h3>⚙️ أداء المكائن</h3>
        </div>
        <div class="machines-report">
          ${machineStats.slice(0, 5).map((m, i) => `
            <div class="mr-item">
              <div class="mr-rank">${i + 1}</div>
              <div class="mr-info">
                <div class="mr-name">${Utils.esc(m.name)}</div>
                <div class="mr-code">${Utils.esc(m.code)}</div>
              </div>
              <div class="mr-bar-wrapper">
                <div class="mr-bar" style="width: ${machineStats[0].hours > 0 ? (m.hours / machineStats[0].hours) * 100 : 0}%;"></div>
              </div>
              <div class="mr-stats">
                <div>${m.ordersCount} أمر</div>
                <div>${m.hours} ساعة</div>
                <div>${Utils.money(m.revenue)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- أفضل العملاء وأكثر المواد استهلاكاً -->
      <div class="reports-bottom-grid">
        
        <!-- أفضل العملاء -->
        <div class="card">
          <div class="report-card-header">
            <h3>🏆 أفضل 5 عملاء</h3>
          </div>
          <div class="top-list">
            ${topCustomers.length ? topCustomers.map((c, i) => `
              <div class="top-item">
                <div class="top-rank">${i + 1}</div>
                <div class="top-info">
                  <div class="top-name">${Utils.esc(c.name)}</div>
                  <div class="top-count">${c.count} فاتورة</div>
                </div>
                <div class="top-value">${Utils.money(c.total)}</div>
              </div>
            `).join('') : '<div class="empty-state" style="padding:20px;"><p>لا توجد بيانات</p></div>'}
          </div>
        </div>

        <!-- أكثر المواد استهلاكاً -->
        <div class="card">
          <div class="report-card-header">
            <h3>📦 أكثر 5 مواد استهلاكاً</h3>
          </div>
          <div class="top-list">
            ${topMaterials.length ? topMaterials.map((m, i) => `
              <div class="top-item">
                <div class="top-rank">${i + 1}</div>
                <div class="top-info">
                  <div class="top-name">${Utils.esc(m.name)}</div>
                  <div class="top-count">${m.qty} وحدة</div>
                </div>
                <div class="top-value">${Utils.money(m.cost)}</div>
              </div>
            `).join('') : '<div class="empty-state" style="padding:20px;"><p>لا توجد بيانات</p></div>'}
          </div>
        </div>
      </div>
    `;

    content.innerHTML = html;
    this.injectStyles();
  },

  renderDonutSegments(paid, partial, unpaid) {
    const total = paid + partial + unpaid;
    if (total === 0) return '';
    
    const circumference = 2 * Math.PI * 40;
    let offset = 0;
    const segments = [];
    
    if (paid > 0) {
      const length = (paid / total) * circumference;
      segments.push(`<circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" stroke-width="12" 
        stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}"/>`);
      offset += length;
    }
    if (partial > 0) {
      const length = (partial / total) * circumference;
      segments.push(`<circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" stroke-width="12" 
        stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}"/>`);
      offset += length;
    }
    if (unpaid > 0) {
      const length = (unpaid / total) * circumference;
      segments.push(`<circle cx="50" cy="50" r="40" fill="none" stroke="#dc2626" stroke-width="12" 
        stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}"/>`);
    }
    
    return segments.join('');
  },

  getDateLimit() {
    const now = new Date();
    switch (this.period) {
      case 'today': 
        const today = new Date(); today.setHours(0,0,0,0); return today;
      case 'week': return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case 'month': return new Date(now - 30 * 24 * 60 * 60 * 1000);
      default: return null;
    }
  },

  getPrevDateLimit() {
    const now = new Date();
    switch (this.period) {
      case 'today': {
        const y = new Date(now - 24 * 60 * 60 * 1000); y.setHours(0,0,0,0);
        const e = new Date(); e.setHours(0,0,0,0);
        return { start: y, end: e };
      }
      case 'week': return { start: new Date(now - 14 * 24 * 60 * 60 * 1000), end: new Date(now - 7 * 24 * 60 * 60 * 1000) };
      case 'month': return { start: new Date(now - 60 * 24 * 60 * 60 * 1000), end: new Date(now - 30 * 24 * 60 * 60 * 1000) };
      default: return null;
    }
  },

  getPeriodLabel() {
    return { today: 'اليوم', week: 'آخر 7 أيام', month: 'آخر 30 يوم', all: 'كل الفترات' }[this.period];
  },

  setPeriod(p) {
    this.period = p;
    this.render();
  },

  getLast7DaysData(invoices) {
    const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    const result = [];
    let max = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayInvoices = invoices.filter(inv => inv.createdAt && inv.createdAt.startsWith(dateStr));
      const amount = dayInvoices.reduce((s, inv) => s + (Number(inv.paidAmount) || 0), 0);
      if (amount > max) max = amount;
      result.push({ label: days[d.getDay()], amount, percent: 0 });
    }
    result.forEach(r => { r.percent = max > 0 ? Math.max(8, (r.amount / max) * 100) : 8; });
    return result;
  },

  printComprehensive() {
    const settings = DB.getSettings();
    const logo = settings.companyLogo || '';
    const projects = DB.get('projects') || [];
    const invoices = DB.get('invoices') || [];
    const expenses = DB.get('expenses') || [];
    const orders = DB.get('production_orders') || [];
    const machines = DB.get('machines') || [];

    const totalSales = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalCollected = invoices.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const netProfit = totalCollected - totalExpenses;

    const machineStats = machines.map(m => {
      const mOrders = orders.filter(o => o.machineId === m.id);
      const hours = mOrders.reduce((sum, o) => sum + (Number(o.totalHours) || 0), 0);
      return { ...m, hours, revenue: hours * (Number(m.hourlyCost) || 0) };
    }).sort((a, b) => b.hours - a.hours);

    const win = window.open('', '_blank', 'width=800,height=600');
    const html = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>التقرير الشامل</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; background:#f5f5f5; padding:20px; direction:rtl; }
          .page { background:#fff; max-width:800px; margin:0 auto; padding:30px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
          .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1e40af; padding-bottom:16px; margin-bottom:24px; }
          .company-info h1 { font-size:22px; color:#1e40af; margin-bottom:4px; font-weight:800; }
          .company-info p { font-size:11px; color:#64748b; line-height:1.6; }
          .company-logo { width:60px; height:60px; object-fit:contain; margin-bottom:8px; }
          .report-title { text-align:left; }
          .report-title h2 { font-size:22px; color:#1e293b; margin-bottom:4px; }
          .report-title p { font-size:12px; color:#64748b; }
          .section { margin-bottom:24px; page-break-inside:avoid; }
          .section-title { font-size:15px; font-weight:800; color:#1e40af; margin-bottom:12px; padding-bottom:6px; border-bottom:2px solid #dbeafe; }
          .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
          .kpi-box { padding:14px; border-radius:10px; text-align:center; }
          .kpi-box.blue { background:#dbeafe; }
          .kpi-box.green { background:#dcfce7; }
          .kpi-box.red { background:#fee2e2; }
          .kpi-box.amber { background:#fef3c7; }
          .kpi-label { font-size:10px; font-weight:600; margin-bottom:4px; opacity:0.8; }
          .kpi-value { font-size:16px; font-weight:800; }
          table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px; }
          thead { background:#1e293b; color:#fff; }
          th { padding:10px; text-align:right; font-weight:600; }
          td { padding:10px; border-bottom:1px solid #e2e8f0; }
          tbody tr:nth-child(even) { background:#f8fafc; }
          .footer { text-align:center; font-size:10px; color:#94a3b8; padding-top:20px; border-top:1px solid #e2e8f0; margin-top:20px; }
          .print-actions { position:fixed; top:15px; left:15px; display:flex; gap:8px; z-index:999; }
          .btn { padding:10px 20px; border:none; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.15); }
          .btn-p { background:#1e40af; color:#fff; }
          .btn-c { background:#fff; color:#333; border:1px solid #ddd; }
          @media print { body { background:#fff; padding:0; } .page { box-shadow:none; } .print-actions { display:none; } }
        </style>
      </head>
      <body>
        <div class="print-actions">
          <button class="btn btn-p" onclick="window.print()">🖨️ طباعة</button>
          <button class="btn btn-c" onclick="window.close()">✖ إغلاق</button>
        </div>
        <div class="page">
          <div class="header">
            <div class="company-info">
              ${logo ? `<img src="${logo}" class="company-logo">` : ''}
              <h1>${settings.companyName || 'ورشة التصنيع'}</h1>
              <p>📞 ${settings.companyPhone || ''}<br>${settings.companyAddress || ''}</p>
            </div>
            <div class="report-title">
              <h2>التقرير الشامل</h2>
              <p>${Utils.date(new Date(), true)}</p>
            </div>
          </div>

          <div class="section">
            <div class="section-title">💰 الملخص المالي</div>
            <div class="kpi-grid">
              <div class="kpi-box blue">
                <div class="kpi-label">إجمالي المبيعات</div>
                <div class="kpi-value">${Utils.money(totalSales)}</div>
              </div>
              <div class="kpi-box green">
                <div class="kpi-label">المحصل</div>
                <div class="kpi-value">${Utils.money(totalCollected)}</div>
              </div>
              <div class="kpi-box red">
                <div class="kpi-label">المصروفات</div>
                <div class="kpi-value">${Utils.money(totalExpenses)}</div>
              </div>
              <div class="kpi-box amber">
                <div class="kpi-label">صافي الربح</div>
                <div class="kpi-value">${Utils.money(netProfit)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">📊 الإحصائيات العامة</div>
            <table>
              <tbody>
                <tr><td>إجمالي المشاريع</td><td style="font-weight:700;">${projects.length}</td></tr>
                <tr><td>المشاريع المكتملة</td><td style="font-weight:700;">${projects.filter(p => ['completed', 'delivered'].includes(p.status)).length}</td></tr>
                <tr><td>إجمالي الفواتير</td><td style="font-weight:700;">${invoices.length}</td></tr>
                <tr><td>الفواتير المدفوعة</td><td style="font-weight:700;">${invoices.filter(i => i.status === 'paid').length}</td></tr>
                <tr><td>أوامر التصنيع</td><td style="font-weight:700;">${orders.length}</td></tr>
                <tr><td>عدد المكائن</td><td style="font-weight:700;">${machines.length}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">⚙️ أداء المكائن</div>
            <table>
              <thead>
                <tr>
                  <th>الماكينة</th>
                  <th>الساعات</th>
                  <th>الإيراد</th>
                </tr>
              </thead>
              <tbody>
                ${machineStats.slice(0, 5).map(m => `
                  <tr>
                    <td style="font-weight:700;">${Utils.esc(m.name)}</td>
                    <td>${m.hours}</td>
                    <td>${Utils.money(m.revenue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            ${settings.companyName || 'ورشة التصنيع'} — تقرير صادر عن IBRA Soft ERP
          </div>
        </div>
      </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
  },

  injectStyles() {
    if (document.getElementById('report-styles-v3')) return;
    const style = document.createElement('style');
    style.id = 'report-styles-v3';
    style.innerHTML = `
      /* فلاتر الفترة */
      .reports-period-filter {
        display: flex; gap: 6px; margin-bottom: 16px;
        background: #fff; padding: 6px; border-radius: 12px;
        border: 1px solid var(--border); overflow-x: auto;
      }
      .rpf-btn {
        flex: 1; padding: 10px 12px; background: transparent; border: none;
        border-radius: 8px; font-size: 12px; font-weight: 700;
        color: var(--text-muted); cursor: pointer; font-family: inherit;
        white-space: nowrap; transition: all 0.2s;
      }
      .rpf-btn.active { background: linear-gradient(135deg, #1e40af, #0f172a); color: #fff; }

      /* البطاقة الرئيسية */
      .report-hero-blue {
        background: linear-gradient(135deg, #1e40af 0%, #0f172a 100%);
        border-radius: 20px; padding: 22px; color: #fff;
        margin-bottom: 16px;
        box-shadow: 0 10px 30px rgba(30,64,175,0.3);
        position: relative; overflow: hidden;
      }
      .report-hero-blue::before {
        content: ''; position: absolute;
        top: -50px; right: -50px; width: 250px; height: 250px;
        background: radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%);
        border-radius: 50%;
      }
      .rhb-title { font-size: 14px; font-weight: 700; opacity: 0.9; margin-bottom: 16px; position: relative; z-index: 1; }
      .rhb-grid {
        display: grid; grid-template-columns: repeat(2, 1fr);
        gap: 10px; position: relative; z-index: 1;
      }
      @media (min-width: 600px) { .rhb-grid { grid-template-columns: repeat(4, 1fr); } }
      .rhb-item {
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        border-radius: 12px; padding: 12px;
      }
      .rhb-label { font-size: 10px; opacity: 0.85; margin-bottom: 4px; }
      .rhb-value { font-size: 16px; font-weight: 800; }
      .rhb-growth { font-size: 10px; margin-top: 4px; }
      .rhb-growth.positive { color: #86efac; }
      .rhb-growth.negative { color: #fca5a5; }

      /* بطاقات KPI */
      .reports-kpi-grid {
        display: grid; grid-template-columns: repeat(2, 1fr);
        gap: 10px; margin-bottom: 16px;
      }
      @media (min-width: 768px) { .reports-kpi-grid { grid-template-columns: repeat(4, 1fr); } }
      .rkpi-card {
        background: #fff; border-radius: 14px; padding: 14px;
        display: flex; align-items: center; gap: 12px;
        border: 1px solid var(--border);
        box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      }
      .rkpi-projects { border-right: 4px solid #2563eb; }
      .rkpi-invoices { border-right: 4px solid #10b981; }
      .rkpi-customers { border-right: 4px solid #f59e0b; }
      .rkpi-orders { border-right: 4px solid #8b5cf6; }
      .rkpi-icon { font-size: 24px; }
      .rkpi-info { flex: 1; min-width: 0; }
      .rkpi-value { font-size: 18px; font-weight: 800; color: var(--text); }
      .rkpi-label { font-size: 11px; color: var(--text-muted); }
      .rkpi-sub { font-size: 9px; color: var(--text-light); margin-top: 2px; }

      /* الصف الأوسط */
      .reports-middle-grid {
        display: grid; grid-template-columns: 1fr;
        gap: 14px; margin-bottom: 16px;
      }
      @media (min-width: 768px) { .reports-middle-grid { grid-template-columns: 1fr 1fr; } }

      .report-card-header {
        margin-bottom: 14px;
      }
      .report-card-header h3 {
        font-size: 14px; margin: 0; font-weight: 700;
      }

      /* الرسم البياني */
      .reports-chart {
        display: flex; gap: 8px; height: 160px;
        align-items: flex-end; padding-top: 10px;
      }
      .rc-bar-item {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; gap: 4px; height: 100%;
        justify-content: flex-end;
      }
      .rc-bar-value {
        font-size: 9px; color: var(--text-muted);
        font-weight: 700; height: 12px;
      }
      .rc-bar-track {
        flex: 1; width: 100%; max-width: 40px;
        background: #f1f5f9; border-radius: 8px;
        position: relative; overflow: hidden;
      }
      .rc-bar-fill {
        position: absolute; bottom: 0; width: 100%;
        background: linear-gradient(180deg, #3b82f6, #1e40af);
        border-radius: 8px;
        transition: height 0.8s;
      }
      .rc-bar-label { font-size: 10px; color: var(--text-muted); font-weight: 600; }

      /* دائرة حالة الفواتير */
      .invoice-status-chart {
        display: flex; align-items: center; gap: 16px;
        flex-wrap: wrap;
      }
      .isc-donut {
        position: relative; width: 140px; height: 140px;
        flex-shrink: 0;
      }
      .isc-donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
      .isc-bg { fill: none; stroke: #f1f5f9; stroke-width: 12; }
      .isc-center {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
      }
      .isc-total { font-size: 24px; font-weight: 900; color: var(--text); }
      .isc-label { font-size: 10px; color: var(--text-muted); }
      .isc-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
      .isc-legend-item {
        display: flex; align-items: center; gap: 8px;
        font-size: 12px;
      }
      .isc-dot { width: 12px; height: 12px; border-radius: 50%; }
      .isc-legend-item span:first-of-type { flex: 1; color: var(--text-muted); }
      .isc-legend-item b { font-size: 14px; color: var(--text); }

      /* أداء المكائن */
      .machines-report { display: grid; gap: 8px; }
      .mr-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px; border-radius: 10px;
        background: #f8fafc;
      }
      .mr-rank {
        width: 28px; height: 28px; border-radius: 50%;
        background: linear-gradient(135deg, #fbbf24, #d97706);
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 12px; flex-shrink: 0;
      }
      .mr-info { min-width: 100px; }
      .mr-name { font-size: 12px; font-weight: 700; }
      .mr-code { font-size: 9px; color: var(--text-muted); }
      .mr-bar-wrapper {
        flex: 1; height: 8px; background: #e2e8f0;
        border-radius: 4px; overflow: hidden; min-width: 60px;
      }
      .mr-bar {
        height: 100%; background: linear-gradient(90deg, #3b82f6, #1e40af);
        border-radius: 4px;
      }
      .mr-stats {
        display: flex; gap: 8px; font-size: 10px; color: var(--text-muted);
      }

      /* أفضل العملاء والمواد */
      .reports-bottom-grid {
        display: grid; grid-template-columns: 1fr;
        gap: 14px; margin-top: 16px;
      }
      @media (min-width: 768px) { .reports-bottom-grid { grid-template-columns: 1fr 1fr; } }
      .top-list { display: grid; gap: 6px; }
      .top-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px; border-radius: 10px;
        background: #f8fafc;
      }
      .top-rank {
        width: 24px; height: 24px; border-radius: 50%;
        background: linear-gradient(135deg, #dbeafe, #93c5fd);
        color: #1e40af; display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 11px; flex-shrink: 0;
      }
      .top-info { flex: 1; min-width: 0; }
      .top-name {
        font-size: 12px; font-weight: 700;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .top-count { font-size: 10px; color: var(--text-muted); }
      .top-value {
        font-size: 12px; font-weight: 800;
        color: var(--primary); white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }
};

console.log('✅ Reports v3 (Advanced) loaded');