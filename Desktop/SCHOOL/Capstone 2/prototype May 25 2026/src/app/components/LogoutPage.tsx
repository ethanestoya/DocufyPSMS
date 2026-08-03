import React from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, ArrowRight, Printer, Home, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';

export default function LogoutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-poppins bg-white">
      {/* Left Side - Logo & Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#1c1f26] overflow-hidden items-center justify-center">
        <ImageWithFallback 
          src="https://images.unsplash.com/photo-1516889454133-d3cd87326a6b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjBtaW5pbWFsJTIwYmx1ZXxlbnwxfHx8fDE3NzU4Mjg1NjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Friendly Workspace"
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        
        {/* Back to Home Button - Top Left */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 z-20 text-white/80 hover:text-white flex items-center gap-2 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        {/* Centered Logo & Brand Message */}
        <div className="relative z-10 p-12 max-w-lg text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-[#1D73EC] rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
            <Printer size={48} className="text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">DocuFy<span className="text-[#1D73EC]">.</span></h1>
          <h2 className="text-2xl font-medium text-white mb-6 leading-tight">See you next time!</h2>
          <p className="text-lg text-blue-100/80 leading-relaxed">
            Your files and orders are safely stored until you return.
          </p>
        </div>
      </div>

      {/* Right Side - Content */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 bg-white relative z-10">
        <div className="max-w-md w-full mx-auto text-center">
          
          {/* Mobile Only Header (Logo & Back) */}
          <div className="lg:hidden flex items-center justify-between mb-12">
            <div className="flex items-center gap-2">
              <div className="bg-[#1D73EC] p-2 rounded-lg text-white">
                <Printer size={24} strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-xl text-[#1c1f26] tracking-tight">
                DocuFy<span className="text-[#1D73EC]">.</span>
              </span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-[#1c1f26] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
          </div>

          <div className="w-20 h-20 bg-white border-2 border-blue-200 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <CheckCircle2 size={40} className="text-[#1D73EC]" strokeWidth={2.5} />
          </div>
          
          <h2 className="text-3xl font-bold text-[#1c1f26] mb-4">You have successfully logged out.</h2>
          
          <p className="text-gray-500 mb-10 text-lg max-w-sm mx-auto leading-relaxed">
            Thank you for using DocuFy. We hope to see you back soon for your next print order!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full sm:w-auto h-12 px-8 bg-[#1D73EC] hover:bg-[#10316B] text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all group"
            >
              Log In Again
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => navigate('/')} 
              className="w-full sm:w-auto h-12 px-8 border-gray-200 text-[#1c1f26] hover:bg-gray-50 font-medium rounded-xl transition-all"
            >
              <Home size={18} className="mr-2 text-gray-500" />
              Return to Homepage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
