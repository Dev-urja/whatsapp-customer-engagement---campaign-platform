import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer, User, AppRole } from '../types';
import { Search, Plus, Filter, UserCheck, Upload, Trash2, Tag, Check, ChevronDown, RefreshCw, Eye, X, BookOpen, AlertCircle, FileSpreadsheet, Download } from 'lucide-react';
import { canManageCustomers, isSalesScoped } from '../permissions';
import { isAcceptedImportFile, parseCsvText, readImportFile, rowsToImportPreview, downloadCustomerImportTemplate, customerImportTemplateCsvText, validateImportRows, buildCustomerFromImportRow } from '../utils/customerImportParser';
import { formatPhoneDisplay } from '../utils/phoneValidation';

interface CustomersManagerProps {
  customers: Customer[];
  users: User[];
  currentUser: User;
  roles: AppRole[];
  onAddCustomer: (newCust: Customer) => void;
  onImportCustomers: (custs: Customer[]) => void;
  onUpdateCustomer: (updatedCust: Customer) => void;
  onDeleteCustomers: (ids: string[]) => void;
}

export default function CustomersManager({
  customers,
  users,
  currentUser,
  roles,
  onAddCustomer,
  onImportCustomers,
  onUpdateCustomer,
  onDeleteCustomers
}: CustomersManagerProps) {
  const salesView = isSalesScoped(currentUser.role, roles);
  const canManage = canManageCustomers(currentUser.role, roles);

  const scopedCustomers = salesView
    ? customers.filter(c => c.assignedSalesUserId === currentUser.id)
    : customers;
  // Navigation & Search State
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedRep, setSelectedRep] = useState<string>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'import'>('list');

  // Customer Detail View Overlay State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Manual Creation form visibility
  const [showAddModal, setShowAddModal] = useState(false);

  // CSV Importer States
  const [rawCsvText, setRawCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    name: '0',
    phone: '1',
    email: '2',
    tags: '3'
  });
  const [validationError, setValidationError] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique tags
  const allUniqueTags = Array.from(new Set(scopedCustomers.flatMap(c => c.tags)));

  // Filtered customer list
  const filteredCustomers = scopedCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.phone.includes(search) ||
                          (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTag = selectedTag === 'All' || c.tags.includes(selectedTag);
    const matchesRep = selectedRep === 'All' || c.assignedSalesUserId === selectedRep;

    return matchesSearch && matchesTag && matchesRep;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredCustomers.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} customer records? This is irreversible.`)) {
      onDeleteCustomers(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleOptInToggle = (cust: Customer) => {
    onUpdateCustomer({
      ...cust,
      optInStatus: !cust.optInStatus
    });
    if (selectedCustomer?.id === cust.id) {
      setSelectedCustomer({ ...selectedCustomer, optInStatus: !cust.optInStatus });
    }
  };

  const handleRepChange = (cust: Customer, repId: string) => {
    onUpdateCustomer({
      ...cust,
      assignedSalesUserId: repId
    });
    if (selectedCustomer?.id === cust.id) {
      setSelectedCustomer({ ...selectedCustomer, assignedSalesUserId: repId });
    }
  };

  const applyParsedRows = (rows: string[][], sourceLabel?: string) => {
    const { headers, dataRows, columnMapping: autoMapping } = rowsToImportPreview(rows);
    setCsvHeaders(headers);
    setCsvPreview(dataRows);
    setColumnMapping(autoMapping);
    setValidationError('');
    if (sourceLabel) setUploadedFileName(sourceLabel);
  };

  const handleParseCsv = () => {
    if (!rawCsvText.trim()) {
      setValidationError('Please upload a file or paste CSV data first.');
      return;
    }

    try {
      applyParsedRows(parseCsvText(rawCsvText));
      setUploadedFileName('');
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Could not parse CSV. Check the format and try again.');
      setCsvPreview([]);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!isAcceptedImportFile(file)) {
      setValidationError('Unsupported file type. Upload a .csv, .xlsx, or .xls file.');
      return;
    }

    setIsParsingFile(true);
    setValidationError('');

    try {
      const { rows, csvText } = await readImportFile(file);
      setRawCsvText(csvText);
      applyParsedRows(rows, file.name);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Could not read the file. Please try again.');
      setCsvPreview([]);
      setCsvHeaders([]);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImportFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleImportFile(file);
  };

  const clearImportData = () => {
    setRawCsvText('');
    setCsvPreview([]);
    setCsvHeaders([]);
    setUploadedFileName('');
    setValidationError('');
    setColumnMapping({ name: '0', phone: '1', email: '2', tags: '3' });
  };

  const handleImportProceed = () => {
    if (csvPreview.length === 0) return;

    const validatedRows = validateImportRows(csvPreview, columnMapping);
    const invalidRows = validatedRows.filter(row => row.errors.length > 0);
    if (invalidRows.length > 0) {
      const summary = invalidRows
        .slice(0, 5)
        .map(row => `Row ${row.rowIndex}: ${row.errors.join(', ')}`)
        .join('\n');
      setValidationError(
        `${invalidRows.length} row(s) failed validation. Fix the file and try again.\n${summary}${invalidRows.length > 5 ? '\n…and more' : ''}`
      );
      return;
    }

    if (users.length === 0) {
      setValidationError('No users available to assign imported customers.');
      return;
    }

    try {
      const importedList: Customer[] = csvPreview.map((row, i) =>
        buildCustomerFromImportRow(
          row,
          columnMapping,
          i,
          users[Math.floor(Math.random() * users.length)].id
        )
      );

      onImportCustomers(importedList);
      setActiveTab('list');
      clearImportData();
      alert(`Successfully imported ${importedList.length} customer records to database!`);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Import failed. Check your data and try again.');
    }
  };

  const handleManualCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newCust: Customer = {
      id: `c-manual-${Date.now()}`,
      name: fd.get('name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      tags: (fd.get('tags') as string).split(',').map(t => t.trim()).filter(t => t !== ''),
      assignedSalesUserId: fd.get('assignedSalesUserId') as string,
      created_at: new Date().toISOString(),
      optInStatus: fd.get('optInStatus') === 'true',
      notes: fd.get('notes') as string
    };

    onAddCustomer(newCust);
    setShowAddModal(false);
    e.currentTarget.reset();
  };

  const getRepName = (userId: string) => {
    return users.find(u => u.id === userId)?.name || 'Unassigned';
  };

  useEffect(() => {
    if (!selectedCustomer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCustomer(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCustomer]);

  const importPreviewValidation = useMemo(
    () => (csvPreview.length > 0 ? validateImportRows(csvPreview, columnMapping) : []),
    [csvPreview, columnMapping]
  );

  const importInvalidCount = importPreviewValidation.filter(row => row.errors.length > 0).length;

  return (
    <div className="space-y-6" id="customers-manager-root">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-2">
            {salesView ? 'My Customers' : 'Customers Database'}
            <span className="text-xs font-mono font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              {scopedCustomers.length} total
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            {salesView
              ? 'View and manage customers assigned to you.'
              : 'View customer details, tags segmentation, and conduct bulk CSV contact injections.'}
          </p>
        </div>

        {canManage && (
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${activeTab === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> List View
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${activeTab === 'import' ? 'bg-white text-urja-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Upload className="w-3.5 h-3.5" /> Import Customers
          </button>
        </div>
        )}
      </div>

      {activeTab === 'import' ? (
        /* File upload / CSV paste importer */
        <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-6 animate-fade-in" id="csv-importer-panel">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-slate-800">Bulk Customer Import</h3>
              <p className="text-xs text-slate-500 max-w-2xl">
                Upload a CSV or Excel file, or paste CSV text below. Columns are auto-detected from headers — review the mapping before importing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadCustomerImportTemplate('csv')}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs px-4 py-2.5 rounded-xl border border-slate-200 transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-urja-primary" />
                CSV Template
              </button>
              <button
                type="button"
                onClick={() => downloadCustomerImportTemplate('xlsx')}
                className="flex items-center gap-2 bg-urja-primary hover:bg-urja-primary/90 text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Excel Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-urja-primary bg-urja-primary/5'
                    : 'border-slate-200 bg-slate-50 hover:border-urja-primary/50 hover:bg-white'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                    {isParsingFile ? (
                      <RefreshCw className="w-6 h-6 text-urja-primary animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-6 h-6 text-urja-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {isParsingFile ? 'Reading file…' : 'Drop your file here or click to browse'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Supports .csv, .xlsx, and .xls</p>
                  </div>
                  {uploadedFileName && (
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      Loaded: {uploadedFileName}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">or paste CSV</span>
                </div>
              </div>

              <label className="block text-xs font-semibold text-slate-500 uppercase font-mono">
                Paste CSV text (optional)
              </label>
              <textarea
                value={rawCsvText}
                onChange={e => {
                  setRawCsvText(e.target.value);
                  setCsvPreview([]);
                  setUploadedFileName('');
                }}
                rows={6}
                placeholder={customerImportTemplateCsvText()}
                className="w-full font-mono text-xs p-4 border border-slate-205 rounded-2xl focus:outline-none focus:border-urja-primary placeholder-slate-400 bg-slate-50 relative"
              />
              
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleParseCsv}
                  disabled={isParsingFile}
                  className="bg-urja-primary hover:bg-urja-primary/90 disabled:opacity-50 text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs"
                >
                  Analyze & Validate Columns
                </button>
                {(rawCsvText || uploadedFileName || csvPreview.length > 0) && (
                  <button
                    type="button"
                    onClick={clearImportData}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-4 py-2.5 rounded-xl transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>

              {validationError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{validationError}</span>
                </div>
              )}
            </div>

            {/* Importer Guidelines card */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 text-xs space-y-4">
              <h4 className="font-semibold text-slate-800">Validation Guidelines</h4>
              <p className="text-slate-600 leading-relaxed">
                Download the template above, fill in your customer rows, then upload the file here.
              </p>
              <ul className="space-y-2 text-slate-600 list-disc pl-4 font-normal">
                <li>Phone must be 7–15 digits. Use <code>+</code> for country code (e.g. <code>+919998912345</code>).</li>
                <li>In Excel, format the Phone column as <strong>Text</strong> before entering numbers, or use our template.</li>
                <li>Separate tags with a semicolon (<code>;</code>) inside the Tags column.</li>
              </ul>
              
              {csvPreview.length > 0 && (
                <div className={`p-4 rounded-xl border flex gap-2 ${importInvalidCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-emerald-50 border-emerald-100 text-emerald-800'}`}>
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">
                      {importInvalidCount > 0 ? 'Validation issues found' : 'Validated successfully!'}
                    </span>
                    Detected <span className="font-bold">{csvPreview.length} records</span>
                    {importInvalidCount > 0 && (
                      <span> — <span className="font-bold">{importInvalidCount}</span> row(s) need fixes before import.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column Mapping Section */}
          {csvPreview.length > 0 && csvHeaders.length > 0 && (
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 space-y-4 animate-slide-up">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
                Column Attribute Mapping
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {['name', 'phone', 'email', 'tags'].map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-600 capitalize">
                      Platform Field: <span className="font-semibold text-teal-600">{field}</span>
                    </label>
                    <select
                      value={columnMapping[field]}
                      onChange={e => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-205 rounded-xl px-2.5 py-1.5 focus:outline-none"
                    >
                      {csvHeaders.map((header, idx) => (
                        <option key={idx} value={idx.toString()}>
                          CSV Header: {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Import Preview Table */}
              <div className="border border-slate-150 rounded-xl bg-white overflow-hidden max-h-[240px] overflow-y-auto">
                <table className="w-full text-[11px] text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 text-left uppercase tracking-wider font-mono">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Mapped Name</th>
                      <th className="p-2.5">Mapped Phone</th>
                      <th className="p-2.5">Mapped Email</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {importPreviewValidation.slice(0, 5).map(row => (
                      <tr key={row.rowIndex} className={row.errors.length > 0 ? 'bg-red-50/60' : ''}>
                        <td className="p-2.5 text-slate-400">{row.rowIndex}</td>
                        <td className="p-2.5">{row.name}</td>
                        <td className={`p-2.5 ${row.errors.some(e => e.toLowerCase().includes('phone')) ? 'text-red-600 font-semibold' : ''}`}>
                          {row.phone}
                        </td>
                        <td className="p-2.5">{row.email}</td>
                        <td className="p-2.5">
                          {row.errors.length > 0 ? (
                            <span className="text-red-600">{row.errors.join('; ')}</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreviewValidation.length > 5 && (
                  <div className="p-2.5 text-center text-slate-400 text-xs font-mono bg-slate-50 border-t border-slate-100">
                    + {importPreviewValidation.length - 5} more records mapped
                  </div>
                )}
              </div>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleImportProceed}
                  disabled={importInvalidCount > 0}
                  className="bg-urja-primary hover:bg-urja-primary/95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium px-6 py-3 rounded-xl transition-all shadow-xs flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save Mapped Records to Database
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW MODULE */
        <div className="space-y-4 animate-fade-in" id="customer-list-module">
          
          {/* Action Row & Search Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-150 shadow-xs">
            {/* Search Box */}
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers by name, phone or email..."
                className="w-full text-xs pl-9 pr-4 py-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-urja-primary placeholder-slate-400"
              />
            </div>

            {/* Tag Filter */}
            <div className="relative">
              <select
                value={selectedTag}
                onChange={e => setSelectedTag(e.target.value)}
                className="w-full text-xs border border-slate-205 rounded-xl pl-3 pr-8 py-2.5 focus:outline-none bg-white appearance-none"
              >
                <option value="All">Filter Tag: All</option>
                {allUniqueTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                <Filter className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Agent allocation filter */}
            {!salesView && (
            <div className="relative">
              <select
                value={selectedRep}
                onChange={e => setSelectedRep(e.target.value)}
                className="w-full text-xs border border-slate-205 rounded-xl pl-3 pr-8 py-2.5 focus:outline-none bg-white appearance-none"
              >
                <option value="All">Assigned User: All</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none text-slate-400">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            )}
          </div>

          {/* Bulk Actions Indicator Bar */}
          {canManage && selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-3.5 bg-slate-900 text-white rounded-xl shadow-md border border-slate-800 animate-slide-up">
              <span className="text-xs font-medium font-mono">
                {selectedIds.length} customer records selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const extraTag = prompt('Enter a new tag to assign to these selected contacts:');
                    if (extraTag) {
                      customers.forEach(c => {
                        if (selectedIds.includes(c.id) && !c.tags.includes(extraTag)) {
                          onUpdateCustomer({ ...c, tags: [...c.tags, extraTag] });
                        }
                      });
                      setSelectedIds([]);
                      alert(`Assigned tag "${extraTag}" to selected records.`);
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Tag className="w-3 h-3" /> Batch Tag
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all font-medium"
                >
                  <Trash2 className="w-3 h-3" /> Delete ({selectedIds.length})
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Primary Customers Table Layout */}
          <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-xs">
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
                Records ({filteredCustomers.length} matching)
              </span>
              {canManage && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Single Customer
              </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  <tr>
                    {canManage && (
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                        onChange={handleSelectAll}
                        className="rounded text-teal-600 focus:ring-teal-505 border-slate-300"
                      />
                    </th>
                    )}
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">WhatsApp Tags</th>
                    {!salesView && <th className="p-4">Assigned Representative</th>}
                    <th className="p-4">Opt-In Status</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={salesView ? 4 : 6} className="p-8 text-center text-slate-400">
                        {salesView
                          ? 'No customers assigned to you yet.'
                          : 'No customer contacts found matching your query filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(cust => (
                      <tr key={cust.id} className="hover:bg-slate-50/70 transition-all">
                        {canManage && (
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(cust.id)}
                            onChange={() => handleSelectOne(cust.id)}
                            className="rounded text-teal-600 focus:ring-teal-505 border-slate-300"
                          />
                        </td>
                        )}
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 text-sm">{cust.name}</span>
                            <span className="text-slate-500 font-mono text-[11px] mt-0.5">{formatPhoneDisplay(cust.phone)}</span>
                            {cust.email && <span className="text-slate-400 text-[10px] mt-0.5">{cust.email}</span>}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {cust.tags.map(t => (
                              <span
                                key={t}
                                className="inline-block text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        {!salesView && (
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={cust.assignedSalesUserId}
                              onChange={e => handleRepChange(cust, e.target.value)}
                              className="text-[11px] text-slate-705 bg-slate-50 border border-slate-205 rounded-lg px-2 py-1 focus:outline-none"
                            >
                              {users.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.role === 'Admin' ? 'Admin' : 'Support'})
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        )}
                        <td className="p-4">
                          <button
                            onClick={() => handleOptInToggle(cust)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${cust.optInStatus ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                          >
                            {cust.optInStatus ? 'Opted-In (Active)' : 'Opted-Out'}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(cust)}
                            className="text-slate-500 hover:text-teal-650 bg-slate-100 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold"
                          >
                            Inspect Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Drawer/View overlay */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-[100] animate-fade-in"
          onClick={() => setSelectedCustomer(null)}
          role="presentation"
        >
          <div
            className="bg-white w-full max-w-lg h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto animate-slide-left space-y-6"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
          >
            
            {/* Header segment with close buttons */}
            <div className="flex justify-between items-start">
              <div>
                <h3 id="customer-detail-title" className="text-xl font-display font-bold text-slate-900">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{formatPhoneDisplay(selectedCustomer.phone)}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border border-slate-150 hover:bg-slate-50 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5">
              {/* Profile Fields block */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 tracking-wider font-mono uppercase">Profile Metadata</h4>
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-700">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Record Created</span>
                    <span className="font-mono mt-0.5 block">{new Date(selectedCustomer.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Email address</span>
                    <span className="mt-0.5 block break-all font-medium text-slate-800">{selectedCustomer.email || 'None declared'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Opt-In Policy Compliance</span>
                    <button
                      onClick={() => handleOptInToggle(selectedCustomer)}
                      className={`mt-1 text-[10px] px-2.5 py-1 rounded font-semibold border ${selectedCustomer.optInStatus ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}
                    >
                      {selectedCustomer.optInStatus ? 'OPTED_IN' : 'OPTED_OUT (Blocked)'}
                    </button>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Assigned Representative</span>
                    <span className="block mt-1 font-semibold text-slate-800">
                      {getRepName(selectedCustomer.assignedSalesUserId)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tag Editor Section */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-505">Segments & Sub-tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCustomer.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                      {t}
                      <button
                        onClick={() => {
                          const updatedTags = selectedCustomer.tags.filter(tag => tag !== t);
                          onUpdateCustomer({ ...selectedCustomer, tags: updatedTags });
                          setSelectedCustomer({ ...selectedCustomer, tags: updatedTags });
                        }}
                        className="text-slate-400 hover:text-slate-600 font-bold ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => {
                      const newTag = prompt('Enter a segment tag to add:');
                      if (newTag?.trim()) {
                        const updatedTags = [...selectedCustomer.tags, newTag.trim()];
                        onUpdateCustomer({ ...selectedCustomer, tags: updatedTags });
                        setSelectedCustomer({ ...selectedCustomer, tags: updatedTags });
                      }
                    }}
                    className="inline-flex items-center text-[10px] bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded-lg transition-all"
                  >
                    + Add Tag
                  </button>
                </div>
              </div>

              {/* Profile Notes block */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-505">Representative Notes Log</label>
                <textarea
                  value={selectedCustomer.notes || ''}
                  onChange={e => {
                    onUpdateCustomer({ ...selectedCustomer, notes: e.target.value });
                    setSelectedCustomer({ ...selectedCustomer, notes: e.target.value });
                  }}
                  rows={4}
                  placeholder="Insert custom customer info notes for your sales rep team..."
                  className="w-full text-xs p-3 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500 placeholder-slate-400"
                />
              </div>

              {/* Mock Chat History log indicator */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-505">Recent Thread History</label>
                <div className="border border-slate-150 rounded-xl p-3 bg-slate-50 text-xs text-slate-500 space-y-1">
                  <p>● Chat activity logged: <span className="font-semibold text-slate-800">Yes</span></p>
                  <p>● Last dynamic action: <span className="font-semibold text-slate-800">Campaign batch sent via welcomes</span></p>
                  <p className="text-[10px] text-slate-400">Status synced over Cloud API callback endpoints.</p>
                </div>
              </div>
            </div>

            {canManage && (
            <div className="pt-4 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this customer log entirely?')) {
                    onDeleteCustomers([selectedCustomer.id]);
                    setSelectedCustomer(null);
                  }
                }}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> De-Register Contact
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-xl w-full max-w-md p-6 space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest font-mono">Create Customer Profile</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-450 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Wanda Maximoff"
                  className="w-full text-xs p-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Phone Number *</label>
                <input
                  type="text"
                  name="phone"
                  required
                  placeholder="e.g. +1 555-222-3333"
                  className="w-full text-xs p-2.5 font-mono border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Email Address (Optional)</label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g. wanda@westview.io"
                  className="w-full text-xs p-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Initial Tags (Comma separated)</label>
                <input
                  type="text"
                  name="tags"
                  placeholder="e.g. VIP, Warm Lead, NorthRegion"
                  className="w-full text-xs p-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Assign Rep *</label>
                  <select name="assignedSalesUserId" className="w-full text-xs p-2.5 border border-slate-205 rounded-xl bg-white focus:outline-none">
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-600">Opt-In Status</label>
                  <select name="optInStatus" className="w-full text-xs p-2.5 border border-slate-205 rounded-xl bg-white focus:outline-none">
                    <option value="true">Opted-In (Active Messages)</option>
                    <option value="false">Opted-Out (Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">Notes Log</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full text-xs p-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500"
                  placeholder="Insert custom customer info notes..."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-xs"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
