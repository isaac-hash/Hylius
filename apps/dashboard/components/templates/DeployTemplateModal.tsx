import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/providers/auth.provider';

export default function DeployTemplateModal({ template, onClose }: { template: any, onClose: () => void }) {
    const router = useRouter();
    const { token } = useAuth();
    const [step, setStep] = useState(1);
    
    // Server fetch
    const [servers, setServers] = useState<any[]>([]);
    
    // Form state
    const [serverId, setServerId] = useState("");
    const [appName, setAppName] = useState(template.id + "-" + Math.floor(Math.random() * 1000));
    const [deployPath, setDeployPath] = useState("/var/www/" + appName);
    const [domainHostname, setDomainHostname] = useState("");
    const [envValues, setEnvValues] = useState<Record<string, string>>({});
    
    const [isDeploying, setIsDeploying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        fetch("/api/servers?_t=" + Date.now(), { 
            cache: "no-store", 
            headers: { 
                "Pragma": "no-cache",
                "Authorization": `Bearer ${token}`
            } 
        })
            .then(res => res.json())
            .then(data => {
                console.log("Fetched servers array:", data);
                if (Array.isArray(data)) {
                    setServers(data);
                    if (data.length > 0) setServerId(data[0].id);
                } else if (data.error) {
                    console.error("Servers fetch error:", data.error);
                }
            })
            .catch(err => console.error("Fetch failed", err));
            
        // Pre-fill default env values
        const defaults: Record<string, string> = {};
        if (template.envSchema) {
            template.envSchema.forEach((field: any) => {
                if (field.defaultValue) {
                    defaults[field.key] = field.defaultValue;
                }
            });
        }
        setEnvValues(defaults);
    }, [template, token]);

    // Update deploy path automatically when app name changes, if user hasn't heavily customized it
    const handleAppNameChange = (val: string) => {
        setAppName(val);
        setDeployPath(`/var/www/${val.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`);
    };

    const handleEnvChange = (key: string, value: string) => {
        setEnvValues(prev => ({ ...prev, [key]: value }));
    };

    const handleNext = () => {
        if (!serverId || !appName || !deployPath) {
            setError("Please fill all required basic fields.");
            return;
        }
        
        // Validate required env fields
        const missingFields = template.envSchema?.filter(
            (f: any) => f.required && !envValues[f.key]
        );
        if (missingFields?.length > 0) {
            setError(`Missing required fields: ${missingFields.map((f: any) => f.label).join(', ')}`);
            return;
        }
        
        setError(null);
        setStep(2);
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        setError(null);

        try {
            const res = await fetch("/api/templates/deploy", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    templateId: template.id,
                    serverId,
                    appName,
                    deployPath,
                    domainHostname: domainHostname || undefined,
                    envOverrides: envValues,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Deployment failed");

            // Successful trigger -> redirect to project's deployment list so they can see logs
            router.push(`/deployments?projectId=${data.projectId}`);
        } catch (err: any) {
            setError(err.message);
            setIsDeploying(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-800 border border-neutral-700 rounded-xl flex items-center justify-center text-xl shadow-inner">
                            {template.icon}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">Deploy {template.name}</h2>
                            <p className="text-xs text-neutral-400">Step {step} of 2</p>
                        </div>
                    </div>
                    {!isDeploying && (
                        <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white border-b border-neutral-800 pb-2">Basic Settings</h3>
                                
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">Target Server</label>
                                    <select 
                                        value={serverId} 
                                        onChange={e => setServerId(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-colors"
                                    >
                                        <option value="" disabled>Select a server</option>
                                        {servers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">App Name</label>
                                        <input 
                                            type="text" 
                                            value={appName}
                                            onChange={e => handleAppNameChange(e.target.value)}
                                            className="w-full bg-black border border-neutral-800 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-400 mb-1.5">Deploy Path on VPS</label>
                                        <input 
                                            type="text" 
                                            value={deployPath}
                                            onChange={e => setDeployPath(e.target.value)}
                                            className="w-full bg-black border border-neutral-800 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none text-neutral-300"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                                        Custom Domain <span className="text-neutral-600">(Optional)</span>
                                    </label>
                                    <div className="flex bg-black border border-neutral-800 rounded-lg overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-colors">
                                        <div className="px-3 py-2.5 bg-neutral-900 border-r border-neutral-800 text-neutral-500 text-sm flex items-center shrink-0">
                                            https://
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="app.yourdomain.com"
                                            value={domainHostname}
                                            onChange={e => setDomainHostname(e.target.value.replace('https://', '').replace('http://', ''))}
                                            className="flex-1 bg-transparent text-white px-3 py-2.5 outline-none font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {template.envSchema && template.envSchema.length > 0 && (
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-lg font-bold text-white border-b border-neutral-800 pb-2">Configuration Variables</h3>
                                    
                                    <div className="grid gap-4">
                                        {template.envSchema.map((field: any) => (
                                            <div key={field.key}>
                                                <label className="block text-sm font-medium text-neutral-300 mb-1">
                                                    {field.label}
                                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                                </label>
                                                {field.description && (
                                                    <p className="text-xs text-neutral-500 mb-2">{field.description}</p>
                                                )}
                                                <input 
                                                    type={field.type === 'password' ? 'password' : 'text'} 
                                                    value={envValues[field.key] || ''}
                                                    onChange={e => handleEnvChange(field.key, e.target.value)}
                                                    placeholder={field.defaultValue || ''}
                                                    className="w-full bg-black border border-neutral-800 text-white rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-colors"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-xl">
                                <h3 className="font-bold text-blue-400 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Ready to Deploy
                                </h3>
                                <p className="text-sm text-blue-300/80 mb-4">
                                    Hylius will safely connect to your VPS and begin the deployment process. Any required databases will be automatically provisioned beforehand.
                                </p>
                                
                                <ul className="space-y-2 text-sm text-neutral-300">
                                    <li className="flex justify-between">
                                        <span className="text-neutral-500">Target:</span>
                                        <span>{servers.find(s => s.id === serverId)?.name || serverId}</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-neutral-500">Stack:</span>
                                        <span>{template.name}</span>
                                    </li>
                                    {template.requiresDatabase?.length > 0 && (
                                        <li className="flex justify-between items-center">
                                            <span className="text-neutral-500">Linked Databases:</span>
                                            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                                                {template.requiresDatabase.join(', ')}
                                            </span>
                                        </li>
                                    )}
                                    {domainHostname && (
                                        <li className="flex justify-between">
                                            <span className="text-neutral-500">Domain:</span>
                                            <span className="text-green-400 font-mono">https://{domainHostname}</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-neutral-800 bg-neutral-900 rounded-b-2xl flex items-center justify-between shrink-0">
                    <div>
                        {step === 2 && !isDeploying && (
                            <button 
                                onClick={() => setStep(1)}
                                className="text-neutral-400 hover:text-white px-4 py-2 transition-colors text-sm font-medium"
                            >
                                ← Back
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            disabled={isDeploying}
                            className="px-5 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 font-medium text-sm transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        
                        {step === 1 ? (
                            <button 
                                onClick={handleNext}
                                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
                            >
                                Continue →
                            </button>
                        ) : (
                            <button 
                                onClick={handleDeploy}
                                disabled={isDeploying}
                                className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm shadow-[0_0_15px_rgba(22,163,74,0.3)] transition-all flex items-center gap-2"
                            >
                                {isDeploying ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Deploying...
                                    </>
                                ) : (
                                    <>
                                        🚀 Deploy {template.name}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
                
            </div>
        </div>
    );
}
